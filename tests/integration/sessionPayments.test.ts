import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

process.env.TOKEN_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.RAZORPAY_OAUTH_CLIENT_ID = 'test_client';
process.env.RAZORPAY_OAUTH_CLIENT_SECRET = 'test_secret';
process.env.RAZORPAY_OAUTH_REDIRECT_URI = 'https://app.test/settings/payments/connect/callback';

const createOrderMock = vi.fn();
const fetchOrderMock = vi.fn();
const fetchOrderPaymentsMock = vi.fn();
vi.mock('$lib/server/razorpay', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/razorpay')>();
	return {
		...actual,
		createSubMerchantOrder: createOrderMock,
		fetchSubMerchantOrder: fetchOrderMock,
		fetchSubMerchantOrderPayments: fetchOrderPaymentsMock
	};
});

// reconnect email is exercised by its own path; keep it a no-op here.
const reconnectEmailMock = vi.fn();
vi.mock('$lib/server/reminderEmails', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/reminderEmails')>();
	return { ...actual, sendRazorpayReconnectEmail: reconnectEmailMock };
});

const { db } = await import('$lib/server/db');
const { payment, therapistRazorpayConnection, razorpayReconcileException } =
	await import('$lib/server/db/schema');
const { storeConnection, revokeConnectionByAccountId } =
	await import('$lib/server/razorpayConnection');
const { startInvoiceCheckout, handleSessionInvoicePaid, sweepStaleOrders } =
	await import('$lib/server/sessionPayments');
const { recordWebhookEvent } = await import('$lib/server/billing');
const { updatePayment } = await import('$lib/server/payments');
const { resetDb, mkTherapist, mkClient, mkPayment } = await import('./helpers');

function tokenResponse(overrides: Record<string, unknown> = {}) {
	return {
		access_token: `acc_${Math.random()}`,
		refresh_token: `ref_${Math.random()}`,
		public_token: 'rzp_test_oauth_pub',
		expires_in: 90 * 24 * 60 * 60,
		razorpay_account_id: 'acc_TEST123',
		...overrides
	};
}

let therapistId: string;
let clientId: string;

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist()).id;
	clientId = (await mkClient(therapistId)).id;
	createOrderMock.mockReset();
	fetchOrderMock.mockReset();
	fetchOrderPaymentsMock.mockReset();
	reconnectEmailMock.mockReset();
});

const HOUR_MS = 60 * 60 * 1000;

describe('startInvoiceCheckout', () => {
	it('creates an order once and reuses it on a second call', async () => {
		await storeConnection(therapistId, tokenResponse(), 'test');
		const pay = await mkPayment(therapistId, clientId, { amount: 1500 });
		createOrderMock.mockResolvedValue({ id: 'order_ABC', amount: 150000, currency: 'INR' });

		const first = await startInvoiceCheckout(clientId, pay.id);
		expect(first).toMatchObject({ ok: true, orderId: 'order_ABC', amountMinor: 150000 });

		const second = await startInvoiceCheckout(clientId, pay.id);
		expect(second).toMatchObject({ ok: true, orderId: 'order_ABC' });
		expect(createOrderMock).toHaveBeenCalledTimes(1);
	});

	it('two concurrent checkouts agree on one order', async () => {
		await storeConnection(therapistId, tokenResponse(), 'test');
		const pay = await mkPayment(therapistId, clientId, { amount: 1500 });
		createOrderMock
			.mockResolvedValueOnce({ id: 'order_ONE', amount: 150000, currency: 'INR' })
			.mockResolvedValueOnce({ id: 'order_TWO', amount: 150000, currency: 'INR' });

		const [a, b] = await Promise.all([
			startInvoiceCheckout(clientId, pay.id),
			startInvoiceCheckout(clientId, pay.id)
		]);
		if (!a.ok || !b.ok) {
			throw new Error('both checkouts should succeed');
		}
		expect(a.orderId).toBe(b.orderId);

		const [row] = await db.select().from(payment).where(eq(payment.id, pay.id));
		expect(row.razorpayOrderId).toBe(a.orderId);
		expect(row.razorpayOrderCreatedAt).not.toBeNull();
	});

	it('mints a fresh order after the therapist changes the amount', async () => {
		await storeConnection(therapistId, tokenResponse(), 'test');
		const pay = await mkPayment(therapistId, clientId, { amount: 1500 });
		createOrderMock
			.mockResolvedValueOnce({ id: 'order_OLD', amount: 150000, currency: 'INR' })
			.mockResolvedValueOnce({ id: 'order_NEW', amount: 200000, currency: 'INR' });

		await startInvoiceCheckout(clientId, pay.id);
		await updatePayment(therapistId, pay.id, { amount: 2000, note: null });

		const again = await startInvoiceCheckout(clientId, pay.id);
		expect(again).toMatchObject({ ok: true, orderId: 'order_NEW', amountMinor: 200000 });
		expect(createOrderMock).toHaveBeenCalledTimes(2);
	});

	it('keeps the order on a paid row when the amount is edited', async () => {
		const pay = await mkPayment(therapistId, clientId, {
			amount: 1500,
			status: 'paid',
			razorpayOrderId: 'order_DONE'
		});
		await updatePayment(therapistId, pay.id, { amount: 1600, note: null });

		const [row] = await db.select().from(payment).where(eq(payment.id, pay.id));
		expect(row.razorpayOrderId).toBe('order_DONE');
	});

	it('blocks a non-INR practice', async () => {
		const usdTherapist = (await mkTherapist({ currency: 'USD' })).id;
		const usdClient = (await mkClient(usdTherapist)).id;
		await storeConnection(usdTherapist, tokenResponse(), 'test');
		const pay = await mkPayment(usdTherapist, usdClient);

		const res = await startInvoiceCheckout(usdClient, pay.id);
		expect(res).toEqual({ ok: false, message: 'currency_unsupported' });
		expect(createOrderMock).not.toHaveBeenCalled();
	});

	it('blocks a therapist with no live connection', async () => {
		const pay = await mkPayment(therapistId, clientId);
		const res = await startInvoiceCheckout(clientId, pay.id);
		expect(res).toEqual({ ok: false, message: 'payments_unavailable' });
	});

	it('blocks a paid invoice', async () => {
		await storeConnection(therapistId, tokenResponse(), 'test');
		const pay = await mkPayment(therapistId, clientId, { status: 'paid', paidVia: 'manual' });
		const res = await startInvoiceCheckout(clientId, pay.id);
		expect(res).toEqual({ ok: false, message: 'not_payable' });
	});
});

describe('handleSessionInvoicePaid', () => {
	it('marks the row paid exactly once — a replay is a no-op', async () => {
		const pay = await mkPayment(therapistId, clientId, {
			amount: 1500,
			razorpayOrderId: 'order_XYZ'
		});

		await handleSessionInvoicePaid({
			orderId: 'order_XYZ',
			razorpayPaymentId: 'pay_1',
			amountMinor: 150000
		});
		const [afterFirst] = await db.select().from(payment).where(eq(payment.id, pay.id));
		expect(afterFirst.status).toBe('paid');
		expect(afterFirst.paidVia).toBe('razorpay');
		expect(afterFirst.razorpayPaymentId).toBe('pay_1');
		const paidAt = afterFirst.paidAt;

		// replay with a different payment id must not overwrite anything
		await handleSessionInvoicePaid({
			orderId: 'order_XYZ',
			razorpayPaymentId: 'pay_2',
			amountMinor: 150000
		});
		const [afterReplay] = await db.select().from(payment).where(eq(payment.id, pay.id));
		expect(afterReplay.razorpayPaymentId).toBe('pay_1');
		expect(afterReplay.paidAt).toEqual(paidAt);
	});

	it('ignores an order it does not know', async () => {
		await expect(
			handleSessionInvoicePaid({ orderId: 'order_UNKNOWN', razorpayPaymentId: 'p', amountMinor: 1 })
		).resolves.toBeUndefined();
	});

	it('still marks paid but logs an exception when the captured amount differs', async () => {
		const pay = await mkPayment(therapistId, clientId, {
			amount: 1500,
			razorpayOrderId: 'order_MISMATCH'
		});

		await handleSessionInvoicePaid({
			orderId: 'order_MISMATCH',
			razorpayPaymentId: 'pay_odd',
			amountMinor: 99900
		});

		const [row] = await db.select().from(payment).where(eq(payment.id, pay.id));
		expect(row.status).toBe('paid');

		const [exc] = await db
			.select()
			.from(razorpayReconcileException)
			.where(eq(razorpayReconcileException.paymentId, pay.id));
		expect(exc.kind).toBe('amount_mismatch');
	});
});

describe('sweepStaleOrders', () => {
	it('resolves an orphaned order that Razorpay reports as paid', async () => {
		await storeConnection(therapistId, tokenResponse(), 'test');
		const pay = await mkPayment(therapistId, clientId, {
			amount: 1500,
			razorpayOrderId: 'order_ORPHAN',
			razorpayOrderCreatedAt: new Date(Date.now() - 2 * HOUR_MS)
		});
		fetchOrderMock.mockResolvedValue({ id: 'order_ORPHAN', status: 'paid', amount: 150000 });
		fetchOrderPaymentsMock.mockResolvedValue([
			{ id: 'pay_captured', status: 'captured', amount: 150000 }
		]);

		await sweepStaleOrders();

		const [row] = await db.select().from(payment).where(eq(payment.id, pay.id));
		expect(row.status).toBe('paid');
		expect(row.razorpayPaymentId).toBe('pay_captured');
	});

	it('leaves a too-fresh order alone', async () => {
		await storeConnection(therapistId, tokenResponse(), 'test');
		await mkPayment(therapistId, clientId, {
			razorpayOrderId: 'order_FRESH',
			razorpayOrderCreatedAt: new Date()
		});

		await sweepStaleOrders();
		expect(fetchOrderMock).not.toHaveBeenCalled();
	});

	it('writes an unresolved_order exception for an order still unpaid a day later', async () => {
		await storeConnection(therapistId, tokenResponse(), 'test');
		const pay = await mkPayment(therapistId, clientId, {
			razorpayOrderId: 'order_STUCK',
			razorpayOrderCreatedAt: new Date(Date.now() - 30 * HOUR_MS)
		});
		fetchOrderMock.mockResolvedValue({ id: 'order_STUCK', status: 'created', amount: 100000 });

		await sweepStaleOrders();

		const [exc] = await db
			.select()
			.from(razorpayReconcileException)
			.where(eq(razorpayReconcileException.paymentId, pay.id));
		expect(exc.kind).toBe('unresolved_order');
	});
});

describe('recordWebhookEvent', () => {
	it('returns true once then false for the same signature', async () => {
		const sig = 'sig_dedupe_1';
		expect(await recordWebhookEvent({ signature: sig, event: 'payment.captured' })).toBe(true);
		expect(await recordWebhookEvent({ signature: sig, event: 'payment.captured' })).toBe(false);
	});
});

describe('revokeConnectionByAccountId', () => {
	it('marks the connection revoked and queues the email', async () => {
		await storeConnection(
			therapistId,
			tokenResponse({ razorpay_account_id: 'acc_REVOKE' }),
			'test'
		);

		await revokeConnectionByAccountId('acc_REVOKE');

		const [conn] = await db
			.select()
			.from(therapistRazorpayConnection)
			.where(eq(therapistRazorpayConnection.therapistId, therapistId));
		expect(conn.status).toBe('revoked');

		expect(reconnectEmailMock).toHaveBeenCalledWith(therapistId, 'revoked');
	});

	it('is a no-op for an unknown account id', async () => {
		await expect(revokeConnectionByAccountId('acc_NOPE')).resolves.toBeUndefined();
		expect(reconnectEmailMock).not.toHaveBeenCalled();
	});
});
