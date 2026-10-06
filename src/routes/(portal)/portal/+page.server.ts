import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listClientsForUser } from '$lib/server/clients';
import { setActiveClientCookie } from '$lib/server/activeClient';
import { hasClientProfile } from '$lib/clientProfile';
import { loadPortalSessions, cancelSessionAction } from '$lib/server/portalSessions';

// Portal home: who you are and your upcoming sessions. Everything else has its own page.
export const load: PageServerLoad = async (event) => {
	const { client, displayTimezone } = await event.parent();
	const { sessions } = await loadPortalSessions(client.id, client.therapistId, displayTimezone);

	return {
		clientName: client.name,
		// clients who joined before these were collected get nudged to fill them in
		profileComplete: hasClientProfile(client),
		sessions
	};
};

export const actions: Actions = {
	switchClient: async (event) => {
		if (!event.locals.user) {
			return fail(401);
		}

		const clientId = (await event.request.formData()).get('clientId')?.toString();

		// never trust the posted clientId on its own — only switch to a row that's
		// actually one of this user's own client profiles
		const owned = await listClientsForUser(event.locals.user.id);
		if (!clientId || !owned.some((row) => row.id === clientId)) {
			return fail(403, { message: 'Not your client profile' });
		}

		setActiveClientCookie(event.cookies, clientId);
		return redirect(302, '/portal');
	},

	cancelSession: cancelSessionAction
};
