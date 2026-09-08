import type { PageServerLoad } from './$types';
import { getEffectivePlan } from '$lib/server/billing';
import { therapistFor } from '$lib/server/destination';

// Public marketing page — reachable logged-out. currentTier is only used to
// badge/disable a card when the visitor happens to already be a logged-in
// therapist on that plan. hooks only resolves therapistId under /(app), so
// look the therapist up from the user here.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { currentTier: null };
	}
	const therapistRow = await therapistFor(locals.user.id);
	if (!therapistRow) {
		return { currentTier: null };
	}
	const { tier } = await getEffectivePlan(therapistRow.id);
	return { currentTier: tier };
};
