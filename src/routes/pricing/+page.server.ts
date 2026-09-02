import type { PageServerLoad } from './$types';
import { getEffectivePlan } from '$lib/server/billing';

// Public marketing page — reachable logged-out. currentTier is only used to
// badge/disable a card when the visitor happens to already be a logged-in
// therapist on that plan.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.therapistId) {
		return { currentTier: null };
	}
	const { tier } = await getEffectivePlan(locals.therapistId);
	return { currentTier: tier };
};
