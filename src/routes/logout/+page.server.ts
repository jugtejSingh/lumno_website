import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { auth } from '$lib/server/auth';

export const actions: Actions = {
	default: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		// client-side forms post with ?to=client; only these two fixed targets exist,
		// so the param can't be used as an open redirect
		if (event.url.searchParams.get('to') === 'client') {
			return redirect(302, '/login/client');
		}
		return redirect(302, '/login');
	}
};
