import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	handleWebhookEvent,
	recordWebhookEvent,
	syncClientActivationForCap
} from '$lib/server/billing';
import { cancelSubscription, planNumberFor, verifyWebhookSignature } from '$lib/server/razorpay';
import { revokeConnectionByAccountId } from '$lib/server/razorpayConnection';
import { handleSessionInvoicePaid } from '$lib/server/sessionPayments';
import { settleReferralOnActivation, refundReferralCredit } from '$lib/server/billingReferrals';
import { logError, logInfo } from '$lib/server/log';

// Just the fields we read out of a Razorpay subscription webhook payload.
// https://razorpay.com/docs/webhooks/payloads/subscriptions/
interface RazorpayWebhookPayload {
	event: string;
	// account.app.authorization_revoked carries the account id at the top level.
	account_id?: string;
	payload: {
		subscription?: {
			entity: {
				id: string;
				plan_id: string;
				customer_id: string;
				current_end: number | null;
				notes?: { therapistId?: string; referral?: string; referrerTherapistId?: string };
			};
		};
		payment?: {
			entity: {
				id: string;
				amount: number;
				currency: string;
				order_id?: string; // set for order-backed payments (portal invoices)
			};
		};
	};
}

const ACTIVE_EVENTS = ['subscription.activated', 'subscription.charged'];
// A referral sub sits in `authenticated` for its whole deferred-start free
// month (see docs/referall.md) — treat that as active too, but ONLY when
// notes.referral marks it, so a normal sub's authenticated event (which fires
// before its real activation) can't grant access early.
const REFERRAL_AUTHENTICATED_EVENT = 'subscription.authenticated';
// pending fires while Razorpay is still retrying a failed charge, before it
// gives up and halts — collapsed with halted since neither behaves differently
// from the other (see subscription.status comment in billing.schema.ts).
const PAST_DUE_EVENTS = ['subscription.halted', 'subscription.pending'];
const CANCELLED_EVENTS = ['subscription.cancelled', 'subscription.completed'];

export const POST: RequestHandler = async ({ request }) => {
	const signature = request.headers.get('x-razorpay-signature');
	if (!signature) {
		error(400, 'missing_signature');
	}

	const rawBody = await request.text();
	if (!verifyWebhookSignature(rawBody, signature)) {
		error(400, 'invalid_signature');
	}

	let payload: RazorpayWebhookPayload;
	try {
		payload = JSON.parse(rawBody);
	} catch (err) {
		// Signature matched, so this came from Razorpay — but a body we can't parse
		// is not something a retry will fix. 400 stops the retries.
		logError('webhook.razorpay.parse', err, { bodyLength: rawBody.length });
		error(400, 'invalid_payload');
	}
	if (!payload || typeof payload !== 'object' || typeof payload.event !== 'string' || !payload.payload) {
		logError('webhook.razorpay.parse', new Error('payload missing event or payload fields'));
		error(400, 'invalid_payload');
	}
	logInfo('webhook.razorpay', `received ${payload.event}`);

	// ── Partner-OAuth events — branch before the subscription check ──────────
	// (design doc §12.10). Both dedupe on the razorpay_event unique signature.

	if (payload.event === 'payment.captured') {
		const pay = payload.payload.payment?.entity;
		// order_id absent → a subscription/standalone payment, not a portal
		// invoice; handleSessionInvoicePaid would no-op anyway, so skip early.
		if (pay?.order_id) {
			const fresh = await recordWebhookEvent({
				signature,
				event: payload.event,
				razorpayPaymentId: pay.id,
				amount: pay.amount
			});
			if (fresh) {
				await handleSessionInvoicePaid({
					orderId: pay.order_id,
					razorpayPaymentId: pay.id,
					amountMinor: pay.amount
				});
			}
			return new Response(null, { status: 200 });
		}
	}

	if (payload.event === 'account.app.authorization_revoked') {
		const accountId = payload.account_id;
		if (accountId) {
			const fresh = await recordWebhookEvent({ signature, event: payload.event });
			if (fresh) {
				await revokeConnectionByAccountId(accountId);
			}
		}
		return new Response(null, { status: 200 });
	}

	const subEntity = payload.payload.subscription?.entity;
	const payEntity = payload.payload.payment?.entity;
	const therapistId = subEntity?.notes?.therapistId;

	// No therapistId in notes — can't map this to anyone. Ignore, 200 so
	// Razorpay stops retrying.
	if (!subEntity || !therapistId) {
		return new Response(null, { status: 200 });
	}

	const plan = planNumberFor(subEntity.plan_id);
	const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : null;
	const base = {
		signature,
		therapistId,
		razorpaySubscriptionId: subEntity.id,
		razorpayCustomerId: subEntity.customer_id,
		razorpayPlanId: subEntity.plan_id,
		razorpayPaymentId: payEntity?.id ?? null,
		amount: payEntity?.amount ?? null,
		currency: payEntity?.currency ?? null,
		currentEnd,
		event: payload.event
	};

	const isReferralAuthenticated =
		payload.event === REFERRAL_AUTHENTICATED_EVENT && subEntity.notes?.referral === '1';

	let processed = false;

	if (ACTIVE_EVENTS.includes(payload.event) || isReferralAuthenticated) {
		let oldSubId: string | null;
		({ processed, oldSubId } = await handleWebhookEvent({ ...base, plan, status: 'active' }));
		// New sub is confirmed active — retire the previous live sub, if any.
		if (processed && oldSubId) {
			try {
				await cancelSubscription(oldSubId);
			} catch (err) {
				// best effort — DB is already updated regardless, but a sub left live on
				// Razorpay would keep charging, so this has to be visible in the logs.
				logError('webhook.razorpay.cancelOldSub', err, { therapistId, oldSubId });
			}
		}
		if (processed && isReferralAuthenticated) {
			// The referee's deferred-start sub just activated — this is what earns
			// the referrer their month (see docs/referall.md), not the eventual
			// first real charge. A therapist never involved in a referral just
			// no-ops (no referrerTherapistId in notes).
			const referrerTherapistId = subEntity.notes?.referrerTherapistId;
			if (referrerTherapistId) {
				try {
					await settleReferralOnActivation(referrerTherapistId, therapistId);
				} catch (err) {
					// The razorpay_event row above is already committed, so a retry of
					// this webhook will dedupe and never re-run this — log for manual
					// reconciliation rather than losing the referral silently.
					logError('webhook.razorpay.settleReferralOnActivation', err, {
						referrerTherapistId,
						therapistId
					});
				}
			}
		}
		if (processed && payload.event === 'subscription.charged') {
			// Referrer side only: if they have a credit owed, this charge is the
			// one it cancels out. A therapist with no credit just no-ops.
			if (payEntity) {
				try {
					await refundReferralCredit(therapistId, payEntity.id);
				} catch (err) {
					// Credit is already claimed (see claimReferralCredit) — log for
					// manual reconciliation rather than leaving it silently stuck.
					logError('webhook.razorpay.refundReferralCredit', err, { therapistId });
				}
			}
		}
	} else if (PAST_DUE_EVENTS.includes(payload.event)) {
		// Keep `plan` as the tier the therapist was on — status='past_due' is
		// what actually revokes access (see getEffectivePlan). A successful
		// retry fires subscription.charged and restores status='active' cleanly.
		({ processed } = await handleWebhookEvent({ ...base, plan, status: 'past_due' }));
	} else if (CANCELLED_EVENTS.includes(payload.event)) {
		// Keep `plan` as the tier the therapist had — status='cancelled' is what
		// actually revokes access (see getEffectivePlan). Retaining it, not
		// resetting to 0, is what lets the settings UI show "Pro — access until
		// <date>" for the tail before expiry instead of "Free".
		({ processed } = await handleWebhookEvent({ ...base, plan, status: 'cancelled' }));
	}
	// any other event type: not handled, ignore

	// A plan change just landed — reconcile which clients are bookable against
	// the new cap immediately (upgrade unlocks, downgrade/cancellation locks).
	if (processed) {
		logInfo('webhook.razorpay', `applied ${payload.event}`, { therapistId, plan, subId: subEntity.id });
		await syncClientActivationForCap(therapistId);
	}

	return new Response(null, { status: 200 });
};
