import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { getInviteByToken, linkClientToUser } from '$lib/server/clients';
import { describeAuthError, describeOAuthError } from '$lib/server/authErrors';
import { logError } from '$lib/server/log';

// A client row can be created without an email (the invite is then never sent);
// such a row can't be accepted, so treat it the same as a missing invite.
async function loadValidInvite(token: string) {
	const result = await getInviteByToken(token);
	if ('error' in result) return null;
	if (!result.client.email) return null;
	return { ...result.client, email: result.client.email };
}

// Telling the visitor *why* the link is dead is safe: they already hold the
// token, and the three cases each need a different next step.
const INVALID_REASONS = {
	not_found: {
		title: 'Invite not found',
		body: "This invite link isn't valid. Check the link in your email, or ask your therapist to send a new one."
	},
	expired: {
		title: 'Invite expired',
		body: 'This invite link has expired. Ask your therapist to resend it and use the new link.'
	},
	already_joined: {
		title: 'Invite already used',
		body: 'This invite has already been accepted. Log in to open your portal.'
	}
} as const;

export const load: PageServerLoad = async (event) => {
	const result = await getInviteByToken(event.params.token);
	if ('error' in result && result.error !== undefined) {
		return { invite: null, invalid: INVALID_REASONS[result.error] };
	}
	const invite = result.client;
	if (!invite.email) {
		logError('invite.load', new Error('invite row has no email'), { clientId: invite.id });
		return { invite: null, invalid: INVALID_REASONS.not_found };
	}

	const [existingUser] = await db.select().from(user).where(eq(user.email, invite.email));

	const loggedInUser = event.locals.user;
	const oauthError = describeOAuthError(
		'invite.oauth',
		event.url,
		'Google sign-in failed. Please try again.',
		{ clientId: invite.id }
	);
	return {
		invite: { name: invite.name, email: invite.email },
		invalid: null,
		oauthError,
		hasAccount: Boolean(existingUser),
		loggedInAsMatch: loggedInUser ? loggedInUser.email === invite.email : false,
		loggedInAsOther: loggedInUser ? loggedInUser.email !== invite.email : false
	};
};

export const actions: Actions = {
	password: async (event) => {
		const invite = await loadValidInvite(event.params.token);
		if (!invite) {
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
			const failure = describeAuthError(
				'invite.password',
				error,
				'Could not accept the invite. Please try again.'
			);
			return fail(failure.status, { message: failure.message });
		}

		try {
			await linkClientToUser(invite.id, userId);
		} catch (error) {
			// Signed in, but the client row wasn't attached — the invite is still
			// valid, so a retry from the same page will work.
			logError('invite.link', error, { clientId: invite.id, userId });
			return fail(500, {
				message: "You're signed in, but the invite could not be attached to your account. Please try again."
			});
		}
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
				body: {
					provider: 'google',
					callbackURL: event.url.pathname,
					errorCallbackURL: event.url.pathname
				},
				headers: event.request.headers,
				asResponse: false
			});
			if (!result.url) {
				logError('invite.google', new Error('signInSocial returned no url'));
				return fail(500, { message: 'Could not start Google sign-in. Please try again.' });
			}
			url = result.url;
		} catch (error) {
			const failure = describeAuthError(
				'invite.google',
				error,
				'Could not start Google sign-in. Please try again.'
			);
			return fail(failure.status, { message: failure.message });
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

		try {
			await linkClientToUser(invite.id, event.locals.user.id);
		} catch (error) {
			logError('invite.link', error, { clientId: invite.id, userId: event.locals.user.id });
			return fail(500, { message: 'The invite could not be attached to your account. Please try again.' });
		}
		return redirect(302, '/portal');
	}
};