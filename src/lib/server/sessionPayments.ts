import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	payment,
	razorpayReconcileException,
	therapist,
	therapistRazorpayConnection,
	user
} from '$lib/server/db/schema';
import {
	createSubMerchantOrder,
	fetchSubMerchantOrder,
	fetchSubMerchantOrderPayments
} from '$lib/server/razorpay';
import { getAccessToken } from '$lib/server/razorpayConnection';

// Portal invoice payment — a client pays an unpaid `payment` row via Razorpay
// Checkout, running on the THERAPIST'S connected merchant account (partner OAuth).
// The webhook (payment.captured) is what actually flips the row paid; the browser
// handler just shows "processing". See docs/razorpay-oauth-system-design.md §12.8.

export type StartInvoiceCheckout =
	| {
			ok: true;
			orderId: string;
			key: string; // publicToken — safe for the browser
			amountMinor: number;
			therapistName: string;
	  }
	| { ok: false; message: string };

export async function startInvoiceCheckout(
	clientId: string,
	paymentId: string
): Promise<StartInvoiceCheckout> {
	const [row] = await db
		.select({
			payment: payment,
			currency: therapist.currency,
			therapistId: therapist.id,
			therapistName: user.name,
			connectionStatus: therapistRazorpayConnection.status,
			publicToken: therapistRazorpayConnection.publicToken
		})
		.from(payment)
		.innerJoin(therapist, eq(therapist.id, payment.therapistId))
		.innerJoin(user, eq(user.id, therapist.userId))
		.leftJoin(
			therapistRazorpayConnection,
			eq(therapistRazorpayConnection.therapistId, payment.therapistId)
		)
		.where(and(eq(payment.id, paymentId), eq(payment.clientId, clientId)));

	if (!row) {
		return { ok: false, message: 'invoice_not_found' };
	}
	if (row.payment.status !== 'unpaid' || row.payment.paidVia !== 'manual') {
		return { ok: false, message: 'not_payable' };
	}
	if (row.currency !== 'INR') {
		return { ok: false, message: 'currency_unsupported' };
	}
	if (row.connectionStatus !== 'active' || !row.publicToken) {
		return { ok: false, message: 'payments_unavailable' };
	}

	const amountMinor = row.payment.amount * 100;

	// Reuse the order already attached to this row — the unique constraint on
	// razorpayOrderId means we couldn't create a second one anyway, and a
	// Razorpay order can be reopened. updatePayment clears it when the amount
	// changes, so a stored order always matches the row's amount.
	if (row.payment.razorpayOrderId) {
		return {
			ok: true,
			orderId: row.payment.razorpayOrderId,
			key: row.publicToken,
			amountMinor,
			therapistName: row.therapistName
		};
	}

	let orderId: string;
	try {
		const accessToken = await getAccessToken(row.therapistId);
		const order = await createSubMerchantOrder({
			accessToken,
			amountMinor,
			receipt: paymentId,
			notes: { paymentId, therapistId: row.therapistId, clientId }
		});
		orderId = order.id;
	} catch (err) {
		console.error(`startInvoiceCheckout: order create failed for payment ${paymentId}:`, err);
		return { ok: false, message: 'checkout_failed' };
	}

	// Two "Pay now" clicks in flight at once both reach here with their own order.
	// Only the first attaches; the loser hands back whichever order won so the
	// client never sees an order the webhook can't match. The orphaned Razorpay
	// order is harmless — nothing references it and it just expires.
	const attached = await db
		.update(payment)
		.set({ razorpayOrderId: orderId, razorpayOrderCreatedAt: new Date() })
		.where(and(eq(payment.id, paymentId), isNull(payment.razorpayOrderId)))
		.returning({ id: payment.id });

	if (attached.length === 0) {
		const [winner] = await db
			.select({ razorpayOrderId: payment.razorpayOrderId })
			.from(payment)
			.where(eq(payment.id, paymentId));
		if (!winner?.razorpayOrderId) {
			return { ok: false, message: 'checkout_failed' };
		}
		orderId = winner.razorpayOrderId;
	}

	return { ok: true, orderId, key: row.publicToken, amountMinor, therapistName: row.therapistName };
}

// payment.captured webhook. Idempotent: replays and already-paid rows no-op.
export async function handleSessionInvoicePaid(opts: {
	orderId: string;
	razorpayPaymentId: string;
	amountMinor: number;
}): Promise<void> {
	const [row] = await db
		.select({ id: payment.id, status: payment.status, amount: payment.amount })
		.from(payment)
		.where(eq(payment.razorpayOrderId, opts.orderId));

	if (!row) {
		return; // not one of ours (e.g. a subscription payment.captured)
	}
	if (row.status === 'paid') {
		return;
	}
	if (row.amount * 100 !== opts.amountMinor) {
		// The client did pay — still mark it paid, but leave a reconciliation
		// exception for a human (design doc §7).
		await recordReconcileException(
			row.id,
			'amount_mismatch',
			`expected ${row.amount * 100} paise, captured ${opts.amountMinor}`
		);
	}

	await db
		.update(payment)
		.set({
			status: 'paid',
			paidVia: 'razorpay',
			razorpayPaymentId: opts.razorpayPaymentId,
			paidAt: new Date()
		})
		.where(and(eq(payment.id, row.id), eq(payment.status, 'unpaid')));
}

async function recordReconcileException(
	paymentId: string,
	kind: 'amount_mismatch' | 'unresolved_order',
	detail: string
): Promise<void> {
	await db
		.insert(razorpayReconcileException)
		.values({ paymentId, kind, detail })
		.onConflictDoNothing({
			target: [razorpayReconcileException.paymentId, razorpayReconcileException.kind]
		});
}

// don't chase an order the webhook may still deliver / stop chasing after a week
const SWEEP_MIN_AGE_MS = 30 * 60 * 1000;
const SWEEP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// flag an order still not paid on Razorpay's side this long after checkout started
const UNRESOLVED_AFTER_MS = 24 * 60 * 60 * 1000;

// Lost-webhook recovery (design doc §7). A payment.captured that never arrived
// leaves an unpaid row with a razorpayOrderId; the daily cron asks Razorpay
// directly. ponytail: daily not hourly — fine at this volume, tighten the cron
// if orphans pile up. The "Razorpay payment with no matching order" half of §7
// is skipped: with sub-merchant OAuth every order goes through
// createSubMerchantOrder, so it can't happen in v1.
export async function sweepStaleOrders(): Promise<void> {
	const now = Date.now();
	const rows = await db
		.select({
			id: payment.id,
			amount: payment.amount,
			orderId: payment.razorpayOrderId,
			therapistId: payment.therapistId,
			orderCreatedAt: payment.razorpayOrderCreatedAt
		})
		.from(payment)
		.where(
			and(
				eq(payment.status, 'unpaid'),
				// razorpayOrderCreatedAt is set together with razorpayOrderId, so the
				// range check also implies the order id is present.
				lt(payment.razorpayOrderCreatedAt, new Date(now - SWEEP_MIN_AGE_MS)),
				gt(payment.razorpayOrderCreatedAt, new Date(now - SWEEP_MAX_AGE_MS))
			)
		);

	for (const row of rows) {
		if (!row.orderId || !row.orderCreatedAt) {
			continue;
		}
		const orderId = row.orderId;
		const orderAgeMs = now - row.orderCreatedAt.getTime();
		try {
			const accessToken = await getAccessToken(row.therapistId);
			const order = await fetchSubMerchantOrder(accessToken, orderId);

			if (order.status === 'paid') {
				const payments = await fetchSubMerchantOrderPayments(accessToken, orderId);
				const captured = payments.find((p) => p.status === 'captured');
				if (captured) {
					await handleSessionInvoicePaid({
						orderId,
						razorpayPaymentId: captured.id,
						amountMinor: captured.amount
					});
				}
			} else if (orderAgeMs > UNRESOLVED_AFTER_MS) {
				const hours = Math.round(orderAgeMs / (60 * 60 * 1000));
				await recordReconcileException(
					row.id,
					'unresolved_order',
					`order ${orderId} still '${order.status}' ${hours}h after checkout`
				);
			}
		} catch (err) {
			console.error(`sweepStaleOrders: payment ${row.id} (${orderId}) failed:`, err);
		}
	}
}
