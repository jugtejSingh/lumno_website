import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { getInviteByToken, linkClientToUser } from '$lib/server/clients';

async function loadValidInvite(token: string) {
	const result = await getInviteByToken(token);
	if ('error' in result) return null;
	return result.client;
}

export const load: PageServerLoad = async (event) => {
	const invite = await loadValidInvite(event.params.token);
	if (!invite) {
		return { invite: null };
	}

	const [existingUser] = await db.select().from(user).where(eq(user.email, invite.email!));

	const loggedInUser = event.locals.user;
	return {
		invite: { name: invite.name, email: invite.email },
		hasAccount: Boolean(existingUser),
		loggedInAsMatch: loggedInUser ? loggedInUser.email === invite.email : false,
		loggedInAsOther: loggedInUser ? loggedInUser.email !== invite.email : false
	};
};

export const actions: Actions = {
	password: async (event) => {
		const invite = await loadValidInvite(event.params.token);
		if (!invite || !invite.email) {
			return fail(400, { message: 'This invite is no longer valid.' });
		}

		const formData = await event.request.formData();
		const password = formData.get('password')?.toString();
		if (!password) {
			return fail(400, { message: 'Password is required.' });
		}

		const [existingUser] = await db.select().from(user).where(eq(user.email, invite.email));

		let userId: string;
		try {
			if (existingUser) {
				const result = await auth.api.signInEmail({
					body: { email: invite.email, password },
					headers: event.request.headers,
					asResponse: false
				});
				userId = result.user.id;
			} else {
				const result = await auth.api.signUpEmail({
					body: { email: invite.email, password, name: invite.name },
					headers: event.request.headers,
					asResponse: false
				});
				userId = result.user.id;
			}
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Could not accept the invite.' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		await linkClientToUser(invite.id, userId);
		return redirect(302, '/portal');
	},

	google: async (event) => {
		const invite = await loadValidInvite(event.params.token);
		if (!invite) {
			return fail(400, { message: 'This invite is no longer valid.' });
		}

		let url: string;
		try {
			const result = await auth.api.signInSocial({
				body: { provider: 'google', callbackURL: event.url.pathname },
				headers: event.request.headers,
				asResponse: false
			});
			if (!result.url) {
				return fail(500, { message: 'Could not start Google sign-in' });
			}
			url = result.url;
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Google sign-in failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, url);
	},

	// used when the visitor already has a session matching the invited email —
	// e.g. they just landed back here after the Google OAuth redirect above.
	acceptAsSelf: async (event) => {
		const invite = await loadValidInvite(event.params.token);
		if (!invite) {
			return fail(400, { message: 'This invite is no longer valid.' });
		}
		if (!event.locals.user || event.locals.user.email !== invite.email) {
			return fail(403, { message: 'Log in with the invited email to accept.' });
		}

		await linkClientToUser(invite.id, event.locals.user.id);
		return redirect(302, '/portal');
	}
};