import type { PageServerLoad } from './$types';
import type { TherapistProfile } from '$lib/types/settings';
import { getOrCreateSubscription } from '$lib/server/billing';

export const load: PageServerLoad = async ({ locals }) => {
	const profile: TherapistProfile = {
		name: 'Dana Reyes',
		bio: 'Works with adults managing anxiety and life transitions using CBT and mindfulness-based approaches.',
		rate: '$150',
		visible: true,
		email: 'dana@reyestherapy.com',
		specialties: ['Anxiety', 'CBT']
	};

	// Raw plan/status, not getEffectivePlan — a past_due row intentionally keeps
	// its plan number so the card can show "Pro — payment failed" instead of
	// silently reading as Free. See the webhook handler's plan-retention comment.
	const subscription = await getOrCreateSubscription(locals.therapistId!);
	const billing = {
		plan: subscription.plan,
		status: subscription.status,
		cancelScheduled: subscription.cancelScheduled
	};

	return { profile, billing };
};
