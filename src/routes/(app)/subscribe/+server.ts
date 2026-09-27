import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	CREATING_SENTINEL,
	claimPendingSlot,
	clearPendingSlot,
	finalizePendingSlot,
	getOrCreateSubscription
} from '$lib/server/billing';
import {
	cancelSubscription,
	createSubscription,
	planIdFor,
	razorpayKeyId
} from '$lib/server/razorpay';
import { checkReferralEligibility } from '$lib/server/billingReferrals';
import { logError } from '$lib/server/log';

// Deferred-start free month for a referral (see docs/referall.md).
const REFERRAL_FREE_MONTH_SECONDS = 30 * 24 * 60 * 60;

// A pending sub id is reused only while comfortably inside Razorpay's 30-minute
// expire_by window (subscriptions.create) — otherwise it's treated as expired
// and superseded. Matches edvion's create_or_reuse_pending_sub.
const PENDING_FRESH_MS = 25 * 60 * 1000;

// Backs both branches of /subscribe (new subscription and plan change): dedupes
// hard against double-clicks, refreshes, and concurrent tabs so we never mint
// two live Razorpay subscriptions for the same holder. Matches edvion's
// create_or_reuse_pending_sub in payment_controller.py.
async function createOrReusePendingSub(
	therapistId: string,
	planNumber: number,
	subscription: Awaited<ReturnType<typeof getOrCreateSubscription>>,
	deferStart = false,
	referrerTherapistId?: string
): Promise<string> {
	const pending = subscription.pendingSubId;
	const planId = planIdFor(planNumber);
	const pendingFresh =
		subscription.pendingSince !== null &&
		Date.now() - subscription.pendingSince.getTime() < PENDING_FRESH_MS;

	// Reuse — a fresh pending sub for this exact plan already exists (refresh,
	// back-button, second tab). Create nothing on Razorpay. Never reuse when a
	// deferred start is required: an existing pending sub was minted without
	// the referral start_at, so reusing it would silently drop the free month.
	if (
		pending &&
		pending !== CREATING_SENTINEL &&
		subscription.pendingPlanId === planId &&
		pendingFresh &&
		!deferStart
	) {
		return pending;
	}

	// Claim the slot. The sentinel could only belong to a concurrent creator, so
	// map it to null — only NULL or a stale slot can be taken.
	const seen = pending === CREATING_SENTINEL ? null : pending;
	const claimed = await claimPendingSlot(therapistId, seen);
	if (!claimed) {
		error(409, 'subscription_in_progress');
	}

	// Supersede — an older pending sub (abandoned, or a different plan) whose
	// slot we just took. Cancel it so it can never be authenticated and charged.
	if (pending && pending !== CREATING_SENTINEL) {
		try {
			await cancelSubscription(pending);
		} catch (err) {
			// best effort — an already-cancelled/expired sub errors harmlessly
			logError('subscribe.cancelStalePending', err, { therapistId, pending });
		}
	}

	let newSub;
	try {
		if (deferStart) {
			const startAt = Math.floor(Date.now() / 1000) + REFERRAL_FREE_MONTH_SECONDS;
			newSub = await createSubscription(
				planNumber,
				{ therapistId, referral: '1', referrerTherapistId },
				startAt
			);
		} else {
			newSub = await createSubscription(planNumber, { therapistId });
		}
	} catch (err) {
		logError('subscribe.createSubscription', err, { therapistId, planNumber });
		// Release the slot so the therapist can retry immediately, not in 60s.
		await clearPendingSlot(therapistId, CREATING_SENTINEL);
		error(500, 'subscription_creation_failed');
	}

	await finalizePendingSlot(therapistId, newSub.id, planId);
	return newSub.id;
}

// Upgrade, downgrade, or change billing plan — reached when the therapist
// already has a live sub. UPI AutoPay mandates can't be edited, so every
// change is cancel-old + create-new + re-auth; the current sub stays the
// source of truth until the new one's first charge confirms via webhook.
async function changePlan(
	therapistId: string,
	subscription: Awaited<ReturnType<typeof getOrCreateSubscription>>,
	planNumber: number
) {
	const planId = planIdFor(planNumber);

	// No-op: already on this plan. Drop any half-started change and stay put —
	// unless a cancel is scheduled, in which case "same plan" means Resume:
	// Razorpay has no un-cancel API, so fall through and mint a fresh sub.
	if (planId === subscription.razorpayPlanId && !subscription.cancelScheduled) {
		const pending = subscription.pendingSubId;
		if (pending && pending !== CREATING_SENTINEL) {
			try {
				await cancelSubscription(pending);
			} catch (err) {
				// best effort
				logError('subscribe.cancelSamePlanPending', err, { therapistId, pending });
			}
			await clearPendingSlot(therapistId, pending);
		}
		error(422, 'same_plan');
	}

	const subId = await createOrReusePendingSub(therapistId, planNumber, subscription);
	return json({ subscriptionId: subId, key: razorpayKeyId() });
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const therapistId = locals.therapistId!;
	let body: { plan?: unknown; referrerEmail?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'invalid_plan');
	}
	const planNumber = Number(body?.plan);
	if (planNumber !== 1 && planNumber !== 2) {
		error(422, 'invalid_plan');
	}

	const subscription = await getOrCreateSubscription(therapistId);

	// One entry point: the server decides new-subscription vs plan-change from the row.
	if (subscription.razorpaySubscriptionId) {
		if (subscription.status === 'active') {
			return changePlan(therapistId, subscription, planNumber);
		}
		if (subscription.status !== 'cancelled' && subscription.status !== 'past_due') {
			error(409, 'active_subscription_exists');
		}
	}

	// Referrals are first-subscriptions only — a therapist who has ever had a
	// razorpaySubscriptionId (re-subscribing after cancel/past_due) doesn't
	// qualify as a referee. A referrer must already be on a paid plan
	// (checkReferralEligibility enforces this), so their own credit is always
	// resolved by refunding a later charge (see refundReferralCredit) — never here.
	let deferStart = false;
	let referrerTherapistId: string | null = null;
	if (!subscription.razorpaySubscriptionId && typeof body.referrerEmail === 'string' && body.referrerEmail) {
		const eligibility = await checkReferralEligibility(therapistId, body.referrerEmail);
		if (!eligibility.ok) {
			error(422, eligibility.reason);
		}
		referrerTherapistId = eligibility.referrerTherapistId;
		deferStart = true;
	}

	// The halted subscription still exists on Razorpay's side (with an unpaid
	// invoice). Retire it before creating the replacement so it isn't left
	// dangling — a UPI mandate can't be rebound, so there's no "resume" path.
	if (subscription.status === 'past_due' && subscription.razorpaySubscriptionId) {
		try {
			await cancelSubscription(subscription.razorpaySubscriptionId);
		} catch (err) {
			// best effort
			logError('subscribe.cancelHaltedSub', err, {
				therapistId,
				subId: subscription.razorpaySubscriptionId
			});
		}
	}

	const subId = await createOrReusePendingSub(
		therapistId,
		planNumber,
		subscription,
		deferStart,
		referrerTherapistId ?? undefined
	);
	return json({ subscriptionId: subId, key: razorpayKeyId() });
};
