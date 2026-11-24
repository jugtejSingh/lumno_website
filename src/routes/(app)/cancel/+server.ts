import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOrCreateSubscription, setCancelScheduled } from '$lib/server/billing';
import { cancelSubscription } from '$lib/server/razorpay';
import { logError, logInfo } from '$lib/server/log';

// Always cancel-at-cycle-end — access continues through the paid period,
// status stays 'active' until the period-end webhook flips it. Matches
// edvion's /cancel.
export const POST: RequestHandler = async ({ locals }) => {
	const therapistId = locals.therapistId!;
	const subscription = await getOrCreateSubscription(therapistId);

	if (!subscription.razorpaySubscriptionId) {
		error(404, 'no_active_subscription');
	}
	if (subscription.status === 'cancelled') {
		error(409, 'already_cancelled');
	}
	// Idempotent: Razorpay already has the cancel-at-cycle-end scheduled and
	// would reject a second call. Nothing more to do.
	if (subscription.cancelScheduled) {
		return new Response(null, { status: 200 });
	}

	try {
		const cancelled = await cancelSubscription(subscription.razorpaySubscriptionId);
		// ponytail: temporary trial debugging — remove once trial cancel is verified
		logInfo('trial.debug', 'cancel accepted by razorpay', {
			therapistId,
			subId: cancelled.id,
			status: cancelled.status,
			startAt: cancelled.start_at,
			endAt: cancelled.end_at,
			endedAt: cancelled.ended_at,
			currentEnd: cancelled.current_end
		});
	} catch (err) {
		logError('cancel.cancelSubscription', err, {
			therapistId,
			subId: subscription.razorpaySubscriptionId
		});
		error(500, 'cancellation_failed');
	}

	// Local intent flag only — status stays 'active' so access continues
	// through the paid period; the period-end webhook flips status.
	await setCancelScheduled(therapistId);
	return new Response(null, { status: 200 });
};
