import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

// the token lookup has its own suite; here every therapist is simply "connected"
vi.mock('$lib/server/razorpayConnection', async (importOriginal) => {
	const original = await importOriginal<typeof import('$lib/server/razorpayConnection')>();
	return { ...original, getAccessToken: vi.fn(async () => 'test-access-token') };
});

const { actions } = await import('../../src/routes/(app)/payments/+page.server');
const { GET: getHistory } = await import('../../src/routes/(app)/payments/clients/[clientId]/+server');
const { listVisiblePaymentsForClient } = await import('$lib/server/payments');
const { db } = await import('$lib/server/db');
const { paymentRefund, razorpayReconcileException } = await import('$lib/server/db/schema');
const { resetDb, mkTherapist, mkClient, mkPayment, mkEvent } = await import('./helpers');

// Therapist-initiated refunds (docs/refunds.md): one per payment, via Razorpay or manual.
// Razorpay is faked at the fetch level so the real request shapes are what gets checked.

type FakeRefund = { id: string; payment_id: string; amount: number; receipt: string | null; status: string };

// what the fake Razorpay answers; each test tweaks it
let rzp: {
	payment: { id: string; status: string; amount: number; amount_refunded: number; order_id: string | null };
	createRefund: (body: Record<string, unknown>) => Response;
	refunds: FakeRefund[];
};
let refundRequests: Record<string, unknown>[];

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
	const url = String(input);
	const method = init?.method ?? 'GET';
	if (method === 'POST' && url.endsWith('/refund')) {
		const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
		refundRequests.push(body);
		return Promise.resolve(rzp.createRefund(body));
	}
	if (method === 'GET' && url.endsWith('/refunds')) {
		return Promise.resolve(jsonResponse(200, { items: rzp.refunds }));
	}
	if (method === 'GET' && url.includes('/refunds/')) {
		const id = url.split('/refunds/')[1];
		for (const refund of rzp.refunds) {
			if (refund.id === id) {
				return Promise.resolve(jsonResponse(200, refund));
			}
		}
		return Promise.resolve(jsonResponse(404, { error: { description: 'not found' } }));
	}
	if (method === 'GET' && url.includes('/payments/')) {
		return Promise.resolve(jsonResponse(200, rzp.payment));
	}
	throw new Error(`unexpected Razorpay call: ${method} ${url}`);
}

let therapist: Awaited<ReturnType<typeof mkTherapist>>;
let clientId: string;

// a ₹1000 session the client paid through Razorpay checkout
async function razorpayPaidPayment(amount = 1000) {
	const p = await mkPayment(therapist.id, clientId, {
		amount,
		status: 'paid',
		paidVia: 'razorpay',
		paidAt: new Date(),
		razorpayPaymentId: 'pay_123',
		razorpayOrderId: 'order_123'
	});
	rzp.payment = { id: 'pay_123', status: 'captured', amount: amount * 100, amount_refunded: 0, order_id: 'order_123' };
	return p;
}

async function refund(action: 'refundRazorpay' | 'refundManual', paymentId: string, amount: string, therapistId = therapist.id) {
	return actions[action](
		mkEvent({ locals: { therapistId }, fields: { paymentId, amount } }) as never
	);
}

async function failureMessage(result: unknown): Promise<string> {
	expect(isActionFailure(result)).toBe(true);
	return (result as { data: { message: string } }).data.message;
}

async function refundRows(paymentId: string) {
	return db.select().from(paymentRefund).where(eq(paymentRefund.paymentId, paymentId));
}

async function historyRow(paymentId: string) {
	const event = mkEvent({
		locals: { therapistId: therapist.id },
		params: { clientId },
		url: 'http://localhost/payments/clients/x?page=1'
	});
	const res = await getHistory(event as never);
	const json = (await res.json()) as { rows: { id: string; refund: unknown }[] };
	for (const row of json.rows) {
		if (row.id === paymentId) {
			return row;
		}
	}
	throw new Error('payment not in history');
}

beforeEach(async () => {
	await resetDb();
	therapist = await mkTherapist();
	clientId = (await mkClient(therapist.id)).id;
	refundRequests = [];
	rzp = {
		payment: { id: 'pay_123', status: 'captured', amount: 100000, amount_refunded: 0, order_id: 'order_123' },
		createRefund: (body) =>
			jsonResponse(200, { id: 'rfnd_1', payment_id: 'pay_123', amount: body.amount, receipt: body.receipt, status: 'processed' }),
		refunds: []
	};
	vi.stubGlobal('fetch', vi.fn(fakeFetch));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('refund via Razorpay', () => {
	it('a processed refund is stored, shown as Paid / Refunded, and clears the refund-owed flag', async () => {
		const p = await razorpayPaidPayment();
		await db.insert(razorpayReconcileException).values({
			paymentId: p.id,
			kind: 'cancel_refund',
			detail: '1000'
		});

		const result = await refund('refundRazorpay', p.id, '400');
		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ refundStatus: 'processed' });

		const rows = await refundRows(p.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ status: 'processed', amount: 400, razorpayRefundId: 'rfnd_1', method: 'razorpay' });

		// the request carries paise, our row id as receipt, and only the two trace ids
		expect(refundRequests[0]).toMatchObject({
			amount: 40000,
			receipt: rows[0].id,
			notes: { razorpay_payment_id: 'pay_123', razorpay_order_id: 'order_123' }
		});

		const [flag] = await db.select().from(razorpayReconcileException);
		expect(flag.resolvedAt).not.toBeNull();

		expect((await historyRow(p.id)).refund).toEqual({
			method: 'razorpay',
			amount: 400,
			status: 'processed',
			failureReason: null
		});
	});

	it('a second refund on the same payment is refused, through either method', async () => {
		const p = await razorpayPaidPayment();
		await refund('refundRazorpay', p.id, '400');

		expect(await failureMessage(await refund('refundRazorpay', p.id, '100'))).toMatch(/already been refunded/);
		expect(await failureMessage(await refund('refundManual', p.id, '100'))).toMatch(/already been refunded/);
		expect(refundRequests).toHaveLength(1);
	});

	it('Razorpay refusing (4xx) marks the attempt failed with its reason, and a retry is allowed', async () => {
		const p = await razorpayPaidPayment();
		rzp.createRefund = () => jsonResponse(400, { error: { description: 'Insufficient balance in merchant account' } });

		expect(await failureMessage(await refund('refundRazorpay', p.id, '1000'))).toBe(
			'Insufficient balance in merchant account'
		);
		const [failed] = await refundRows(p.id);
		expect(failed).toMatchObject({ status: 'failed', failureReason: 'Insufficient balance in merchant account' });
		expect((await historyRow(p.id)).refund).toMatchObject({ status: 'failed' });

		rzp.createRefund = (body) =>
			jsonResponse(200, { id: 'rfnd_2', payment_id: 'pay_123', amount: body.amount, receipt: body.receipt, status: 'processed' });
		expect(isActionFailure(await refund('refundRazorpay', p.id, '1000'))).toBe(false);
		const rows = await refundRows(p.id);
		expect(rows).toHaveLength(2);
		expect((await historyRow(p.id)).refund).toMatchObject({ status: 'processed', amount: 1000 });
	});

	it('Razorpay answering pending keeps the row pending with its refund id, then settles on the next look', async () => {
		const p = await razorpayPaidPayment();
		rzp.createRefund = (body) => {
			const pending = { id: 'rfnd_3', payment_id: 'pay_123', amount: Number(body.amount), receipt: String(body.receipt), status: 'pending' };
			rzp.refunds = [pending];
			return jsonResponse(200, pending);
		};

		expect(await refund('refundRazorpay', p.id, '1000')).toEqual({ refundStatus: 'pending' });
		expect((await refundRows(p.id))[0]).toMatchObject({ status: 'pending', razorpayRefundId: 'rfnd_3' });

		rzp.refunds[0].status = 'processed';
		expect((await historyRow(p.id)).refund).toMatchObject({ status: 'processed' });
	});

	it('a timeout leaves the row pending; the next look finds it by receipt and marks it processed', async () => {
		const p = await razorpayPaidPayment();
		rzp.createRefund = (body) => {
			// Razorpay did make the refund, but our side never heard back
			rzp.refunds = [{ id: 'rfnd_4', payment_id: 'pay_123', amount: Number(body.amount), receipt: String(body.receipt), status: 'processed' }];
			throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
		};

		expect(await failureMessage(await refund('refundRazorpay', p.id, '1000'))).toMatch(/Couldn’t confirm/);
		expect((await refundRows(p.id))[0]).toMatchObject({ status: 'pending', razorpayRefundId: null });

		// a second click doesn't send a second refund: it settles the first one and refuses
		expect(await failureMessage(await refund('refundRazorpay', p.id, '1000'))).toMatch(/already been refunded/);
		expect(refundRequests).toHaveLength(1);
		expect((await refundRows(p.id))[0]).toMatchObject({ status: 'processed', razorpayRefundId: 'rfnd_4' });
	});

	it('a timed-out refund Razorpay never got is marked failed only after the grace period', async () => {
		const p = await razorpayPaidPayment();
		rzp.createRefund = () => {
			throw new TypeError('fetch failed');
		};
		await refund('refundRazorpay', p.id, '1000');

		// still inside the grace period: stays pending, and blocks a new attempt
		expect(await failureMessage(await refund('refundRazorpay', p.id, '1000'))).toMatch(/still being confirmed/);
		expect((await refundRows(p.id))[0].status).toBe('pending');

		await db.update(paymentRefund).set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) });
		expect((await historyRow(p.id)).refund).toMatchObject({ status: 'failed' });
	});

	it('refuses before calling Razorpay when the amount is over what was paid', async () => {
		const p = await razorpayPaidPayment();
		expect(await failureMessage(await refund('refundRazorpay', p.id, '1001'))).toMatch(/more than the amount paid/);
		expect(await failureMessage(await refund('refundRazorpay', p.id, '12.5'))).toMatch(/whole number/);
		expect(vi.mocked(fetch)).not.toHaveBeenCalled();
		expect(await refundRows(p.id)).toHaveLength(0);
	});

	it('refuses when Razorpay shows the payment not captured, a different order, or already part-refunded', async () => {
		const p = await razorpayPaidPayment();

		rzp.payment.status = 'refunded';
		expect(await failureMessage(await refund('refundRazorpay', p.id, '100'))).toMatch(/can’t be refunded/);

		rzp.payment.status = 'captured';
		rzp.payment.order_id = 'order_other';
		expect(await failureMessage(await refund('refundRazorpay', p.id, '100'))).toMatch(/doesn’t match/);

		rzp.payment.order_id = 'order_123';
		rzp.payment.amount_refunded = 95000;
		expect(await failureMessage(await refund('refundRazorpay', p.id, '100'))).toMatch(/less than that left/);

		expect(refundRequests).toHaveLength(0);
		expect(await refundRows(p.id)).toHaveLength(0);
	});

	it('only works on Razorpay-paid payments the therapist owns', async () => {
		const manualPaid = await mkPayment(therapist.id, clientId, { status: 'paid', paidVia: 'manual', paidAt: new Date() });
		expect(await failureMessage(await refund('refundRazorpay', manualPaid.id, '100'))).toMatch(/record a manual refund/);

		const unpaid = await mkPayment(therapist.id, clientId);
		expect(await failureMessage(await refund('refundRazorpay', unpaid.id, '100'))).toMatch(/Only a paid payment/);

		const p = await razorpayPaidPayment();
		const other = await mkTherapist();
		expect(await failureMessage(await refund('refundRazorpay', p.id, '100', other.id))).toMatch(/could not be found/);
		expect(refundRequests).toHaveLength(0);
	});
});

describe('manual refund', () => {
	it('records a processed refund with no Razorpay call, and blocks a second one', async () => {
		const p = await mkPayment(therapist.id, clientId, { status: 'paid', paidVia: 'manual', paidAt: new Date() });

		expect(await refund('refundManual', p.id, '1000')).toEqual({ refundStatus: 'processed' });
		expect((await refundRows(p.id))[0]).toMatchObject({
			method: 'manual',
			status: 'processed',
			amount: 1000,
			razorpayPaymentId: null
		});
		expect(vi.mocked(fetch)).not.toHaveBeenCalled();

		expect(await failureMessage(await refund('refundManual', p.id, '1'))).toMatch(/already been refunded/);
	});
});

describe('client portal', () => {
	it('shows a refunded paid payment with the refunded amount, and hides failed attempts', async () => {
		const refunded = await razorpayPaidPayment();
		await refund('refundRazorpay', refunded.id, '400');

		const failedOnly = await mkPayment(therapist.id, clientId, {
			status: 'paid',
			paidVia: 'razorpay',
			paidAt: new Date(),
			razorpayPaymentId: 'pay_999',
			razorpayOrderId: 'order_999'
		});
		rzp.payment = { id: 'pay_999', status: 'captured', amount: 100000, amount_refunded: 0, order_id: 'order_999' };
		rzp.createRefund = () => jsonResponse(400, { error: { description: 'nope' } });
		await refund('refundRazorpay', failedOnly.id, '1000');

		const { rows } = await listVisiblePaymentsForClient(clientId, 1, 10);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ id: refunded.id, amount: 1000, refundAmount: 400, refundStatus: 'processed' });
	});
});
