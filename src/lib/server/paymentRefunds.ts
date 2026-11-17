import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { payment, paymentRefund, razorpayReconcileException } from '$lib/server/db/schema';
import {
	RazorpayRefundRefusedError,
	createSubMerchantRefund,
	fetchSubMerchantPayment,
	fetchSubMerchantPaymentRefunds,
	fetchSubMerchantRefund
} from '$lib/server/razorpay';
import { getAccessToken } from '$lib/server/razorpayConnection';
import { isUniqueViolation } from '$lib/server/dbErrors';
import { logError } from '$lib/server/log';

// Therapist-initiated refunds — one per payment, through Razorpay or recorded as
// manual. States only move pending → processed or pending → failed; a retry after
// 'failed' is a new row. See docs/refunds.md.

export type RefundOutcome =
	| { ok: true; status: 'processed' | 'pending' }
	| { ok: false; message: string };

export type RefundSummary = {
	method: 'razorpay' | 'manual';
	amount: number;
	status: 'pending' | 'processed' | 'failed';
	failureReason: string | null;
};

const NOT_FOUND = 'That payment could not be found. Refresh and try again.';
const NOT_PAID = 'Only a paid payment can be refunded.';
const TOO_MUCH = 'The refund can’t be more than the amount paid.';
const ALREADY_REFUNDED = 'This payment has already been refunded.';
const ALREADY_PENDING = 'A refund for this payment is still being confirmed.';
const NOT_RAZORPAY = 'This payment wasn’t made through Razorpay — record a manual refund instead.';
const RECONNECT = 'Your Razorpay account isn’t connected. Reconnect it in Settings, then try again.';
const RAZORPAY_UNREACHABLE = 'Couldn’t reach Razorpay. Nothing was refunded — try again in a moment.';
const UNCONFIRMED =
	'Couldn’t confirm the refund with Razorpay. Check your Razorpay dashboard before trying again.';

// A timed-out refund with no match on Razorpay is only marked failed after this long,
// so a request Razorpay is still working through isn't written off a second later.
const NOT_FOUND_GRACE_MS = 10 * 60 * 1000;

// The payment row, scoped to the therapist so a posted id can't touch someone else's.
async function loadPayment(therapistId: string, paymentId: string) {
	const [row] = await db
		.select({
			id: payment.id,
			amount: payment.amount,
			status: payment.status,
			paidVia: payment.paidVia,
			razorpayPaymentId: payment.razorpayPaymentId,
			razorpayOrderId: payment.razorpayOrderId
		})
		.from(payment)
		.where(and(eq(payment.id, paymentId), eq(payment.therapistId, therapistId)));
	return row;
}

// The pending or processed refund on a payment, if any — the unique index allows one.
async function findLiveRefund(paymentId: string) {
	const [row] = await db
		.select({ id: paymentRefund.id, status: paymentRefund.status })
		.from(paymentRefund)
		.where(
			and(
				eq(paymentRefund.paymentId, paymentId),
				inArray(paymentRefund.status, ['pending', 'processed'])
			)
		);
	return row;
}

function liveRefundMessage(status: 'pending' | 'processed' | 'failed'): string {
	if (status === 'pending') {
		return ALREADY_PENDING;
	}
	return ALREADY_REFUNDED;
}

// Once money has gone back, the "refund owed" prompts on this payment are done.
async function resolveRefundFlags(paymentId: string): Promise<void> {
	await db
		.update(razorpayReconcileException)
		.set({ resolvedAt: new Date() })
		.where(
			and(
				eq(razorpayReconcileException.paymentId, paymentId),
				inArray(razorpayReconcileException.kind, ['already_paid', 'cancel_refund']),
				isNull(razorpayReconcileException.resolvedAt)
			)
		);
}

async function markProcessed(refundId: string, paymentId: string, razorpayRefundId: string | null) {
	await db
		.update(paymentRefund)
		.set({ status: 'processed', razorpayRefundId })
		.where(and(eq(paymentRefund.id, refundId), eq(paymentRefund.status, 'pending')));
	await resolveRefundFlags(paymentId);
}

async function markFailed(refundId: string, reason: string) {
	await db
		.update(paymentRefund)
		.set({ status: 'failed', failureReason: reason })
		.where(and(eq(paymentRefund.id, refundId), eq(paymentRefund.status, 'pending')));
}

// Map Razorpay's refund status onto our row. 'pending' leaves it pending (with the id saved).
async function applyRazorpayStatus(
	refundId: string,
	paymentId: string,
	razorpayRefundId: string,
	razorpayStatus: string
): Promise<'pending' | 'processed' | 'failed'> {
	if (razorpayStatus === 'processed') {
		await markProcessed(refundId, paymentId, razorpayRefundId);
		return 'processed';
	}
	if (razorpayStatus === 'failed') {
		await db
			.update(paymentRefund)
			.set({ status: 'failed', razorpayRefundId, failureReason: 'Razorpay reported the refund as failed' })
			.where(and(eq(paymentRefund.id, refundId), eq(paymentRefund.status, 'pending')));
		return 'failed';
	}
	await db
		.update(paymentRefund)
		.set({ razorpayRefundId })
		.where(and(eq(paymentRefund.id, refundId), eq(paymentRefund.status, 'pending')));
	return 'pending';
}

// Settle a Razorpay refund left 'pending' — either Razorpay said pending (we have its
// id) or our request timed out (we don't, so look for a refund carrying our receipt).
// Any error here just leaves it pending for the next look.
export async function resolvePendingRefund(therapistId: string, paymentId: string): Promise<void> {
	const [row] = await db
		.select({
			id: paymentRefund.id,
			razorpayPaymentId: paymentRefund.razorpayPaymentId,
			razorpayRefundId: paymentRefund.razorpayRefundId,
			createdAt: paymentRefund.createdAt
		})
		.from(paymentRefund)
		.where(
			and(
				eq(paymentRefund.paymentId, paymentId),
				eq(paymentRefund.therapistId, therapistId),
				eq(paymentRefund.method, 'razorpay'),
				eq(paymentRefund.status, 'pending')
			)
		);
	if (!row || !row.razorpayPaymentId) {
		return;
	}

	try {
		const accessToken = await getAccessToken(therapistId);

		if (row.razorpayRefundId) {
			const refund = await fetchSubMerchantRefund(accessToken, row.razorpayRefundId);
			await applyRazorpayStatus(row.id, paymentId, refund.id, refund.status);
			return;
		}

		const refunds = await fetchSubMerchantPaymentRefunds(accessToken, row.razorpayPaymentId);
		let match = null;
		for (const refund of refunds) {
			if (refund.receipt === row.id) {
				match = refund;
				break;
			}
		}
		if (match) {
			await applyRazorpayStatus(row.id, paymentId, match.id, match.status);
			return;
		}
		if (Date.now() - row.createdAt.getTime() > NOT_FOUND_GRACE_MS) {
			await markFailed(row.id, 'The refund never reached Razorpay');
		}
	} catch (err) {
		logError('paymentRefunds.resolvePendingRefund', err, { paymentId, refundId: row.id });
	}
}

export async function refundViaRazorpay(
	therapistId: string,
	paymentId: string,
	amount: number
): Promise<RefundOutcome> {
	const row = await loadPayment(therapistId, paymentId);
	if (!row) {
		return { ok: false, message: NOT_FOUND };
	}
	if (row.status !== 'paid') {
		return { ok: false, message: NOT_PAID };
	}
	if (row.paidVia !== 'razorpay' || !row.razorpayPaymentId || !row.razorpayOrderId) {
		return { ok: false, message: NOT_RAZORPAY };
	}
	if (amount > row.amount) {
		return { ok: false, message: TOO_MUCH };
	}

	// an earlier timed-out attempt may have settled since — check before refusing on it
	await resolvePendingRefund(therapistId, paymentId);
	const live = await findLiveRefund(paymentId);
	if (live) {
		return { ok: false, message: liveRefundMessage(live.status) };
	}

	let accessToken: string;
	try {
		accessToken = await getAccessToken(therapistId);
	} catch (err) {
		logError('paymentRefunds.refundViaRazorpay.token', err, { paymentId });
		return { ok: false, message: RECONNECT };
	}

	// Razorpay is the proof the money was taken, not our row.
	const amountMinor = amount * 100;
	try {
		const rzpPayment = await fetchSubMerchantPayment(accessToken, row.razorpayPaymentId);
		if (rzpPayment.status !== 'captured') {
			return { ok: false, message: `Razorpay shows this payment as '${rzpPayment.status}', so it can’t be refunded.` };
		}
		if (rzpPayment.order_id !== row.razorpayOrderId) {
			logError('paymentRefunds.orderMismatch', new Error('Razorpay order_id does not match our row'), {
				paymentId,
				ours: row.razorpayOrderId,
				theirs: rzpPayment.order_id
			});
			return { ok: false, message: 'This payment doesn’t match Razorpay’s records, so it wasn’t refunded.' };
		}
		if (amountMinor > rzpPayment.amount - rzpPayment.amount_refunded) {
			return { ok: false, message: 'Razorpay shows less than that left to refund on this payment.' };
		}
	} catch (err) {
		logError('paymentRefunds.refundViaRazorpay.fetch', err, { paymentId });
		return { ok: false, message: RAZORPAY_UNREACHABLE };
	}

	// the pending row is the lock: a double click or second tab hits the unique index
	let refundId: string;
	try {
		const [inserted] = await db
			.insert(paymentRefund)
			.values({
				paymentId,
				therapistId,
				method: 'razorpay',
				amount,
				status: 'pending',
				razorpayPaymentId: row.razorpayPaymentId
			})
			.returning({ id: paymentRefund.id });
		refundId = inserted.id;
	} catch (err) {
		if (isUniqueViolation(err)) {
			return { ok: false, message: ALREADY_PENDING };
		}
		throw err;
	}

	try {
		const refund = await createSubMerchantRefund({
			accessToken,
			paymentId: row.razorpayPaymentId,
			amountMinor,
			receipt: refundId,
			notes: {
				razorpay_payment_id: row.razorpayPaymentId,
				razorpay_order_id: row.razorpayOrderId
			}
		});
		const status = await applyRazorpayStatus(refundId, paymentId, refund.id, refund.status);
		if (status === 'failed') {
			return { ok: false, message: 'Razorpay reported the refund as failed.' };
		}
		return { ok: true, status };
	} catch (err) {
		if (err instanceof RazorpayRefundRefusedError) {
			let reason = err.reason;
			if (!reason) {
				reason = `Razorpay refused the refund (${err.status})`;
			}
			await markFailed(refundId, reason);
			return { ok: false, message: reason };
		}
		// timeout / network drop / 5xx: it may have gone through, so the row stays pending
		logError('paymentRefunds.refundViaRazorpay.create', err, { paymentId, refundId });
		return { ok: false, message: UNCONFIRMED };
	}
}

// The therapist paid it back themselves (cash / UPI / bank) — recorded, no API call.
export async function recordManualRefund(
	therapistId: string,
	paymentId: string,
	amount: number
): Promise<RefundOutcome> {
	const row = await loadPayment(therapistId, paymentId);
	if (!row) {
		return { ok: false, message: NOT_FOUND };
	}
	if (row.status !== 'paid') {
		return { ok: false, message: NOT_PAID };
	}
	if (amount > row.amount) {
		return { ok: false, message: TOO_MUCH };
	}

	await resolvePendingRefund(therapistId, paymentId);
	const live = await findLiveRefund(paymentId);
	if (live) {
		return { ok: false, message: liveRefundMessage(live.status) };
	}

	try {
		await db.insert(paymentRefund).values({
			paymentId,
			therapistId,
			method: 'manual',
			amount,
			status: 'processed'
		});
	} catch (err) {
		if (isUniqueViolation(err)) {
			return { ok: false, message: ALREADY_REFUNDED };
		}
		throw err;
	}
	await resolveRefundFlags(paymentId);
	return { ok: true, status: 'processed' };
}

// For display: per payment, the live (pending/processed) refund, or else the latest
// failed attempt so its reason can be shown. Payments with no refund rows are absent.
export async function listRefundsForPayments(paymentIds: string[]): Promise<Map<string, RefundSummary>> {
	const result = new Map<string, RefundSummary>();
	if (paymentIds.length === 0) {
		return result;
	}

	const rows = await db
		.select({
			paymentId: paymentRefund.paymentId,
			method: paymentRefund.method,
			amount: paymentRefund.amount,
			status: paymentRefund.status,
			failureReason: paymentRefund.failureReason
		})
		.from(paymentRefund)
		.where(inArray(paymentRefund.paymentId, paymentIds))
		.orderBy(desc(paymentRefund.createdAt));

	for (const row of rows) {
		const existing = result.get(row.paymentId);
		const summary: RefundSummary = {
			method: row.method,
			amount: row.amount,
			status: row.status,
			failureReason: row.failureReason
		};
		if (!existing) {
			result.set(row.paymentId, summary);
			continue;
		}
		// a live refund always wins over a failed attempt, even an older one
		if (existing.status === 'failed' && row.status !== 'failed') {
			result.set(row.paymentId, summary);
		}
	}
	return result;
}

// The therapist history view: settle any pending Razorpay refunds on these payments
// first, then list. Pending rows are rare, so the extra Razorpay calls are too.
export async function listRefundsForTherapistPayments(
	therapistId: string,
	paymentIds: string[]
): Promise<Map<string, RefundSummary>> {
	const refunds = await listRefundsForPayments(paymentIds);
	let resolvedAny = false;
	for (const [paymentId, refund] of refunds) {
		if (refund.method === 'razorpay' && refund.status === 'pending') {
			await resolvePendingRefund(therapistId, paymentId);
			resolvedAny = true;
		}
	}
	if (resolvedAny) {
		return listRefundsForPayments(paymentIds);
	}
	return refunds;
}
