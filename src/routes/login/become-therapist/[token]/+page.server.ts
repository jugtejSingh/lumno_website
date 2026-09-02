import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { completeTherapistUpgrade, isValidUpgradeToken } from '$lib/server/therapistUpgrade';

export const load: PageServerLoad = async (event) => {
	return { valid: await isValidUpgradeToken(event.params.token) };
};

export const actions: Actions = {
	default: async (event) => {
		const result = await completeTherapistUpgrade(event.params.token);
		if ('error' in result) {
			return fail(400, { message: 'This link is invalid or has expired.' });
		}
		return redirect(302, '/login?therapistReady=1');
	}
};