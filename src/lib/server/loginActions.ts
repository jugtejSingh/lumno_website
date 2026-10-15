import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { destinationFor, destinationForRole } from '$lib/server/destination';
import { describeAuthError, describeOAuthError } from '$lib/server/authErrors';
import { logError } from '$lib/server/log';

export type LoginRole = 'Therapist' | 'Client';

// Each login page owns one role. The role is fixed here on the server, never read
// from the form, so the client page can't start a flow that provisions a therapist.
function loginPathFor(role: LoginRole): string {
	if (role === 'Client') {
		return '/login/client';
	}
	return '/login';
}

// signInEmail has already created a session and set its cookies on this response,
// but the account doesn't belong on this page. auth.api.signOut can't help here: it
// reads the session from the *request* cookies, which don't have it yet. So delete
// the session row and clear every auth cookie ourselves — including the 5-minute
// cookie cache, which would otherwise keep the deleted session valid.
async function discardNewSession(event: RequestEvent, sessionToken: string) {
	const context = await auth.$context;
	await context.internalAdapter.deleteSession(sessionToken);

	const cookies = Object.values(context.authCookies);
	for (const cookie of cookies) {
		let path = '/';
		if (cookie.attributes.path) {
			path = cookie.attributes.path;
		}
		event.cookies.delete(cookie.name, { path });
	}
}

export async function loadLoginPage(event: RequestEvent) {
	if (event.locals.user) {
		const destination = await destinationFor(event.locals.user.id);
		if (destination) return redirect(302, destination);
	}

	// set by hooks.server.ts, not by Google — the page shows its own banner for it
	if (event.url.searchParams.get('error') === 'account_removed') {
		return { oauthError: null };
	}

	const oauthError = describeOAuthError(
		'login.oauth',
		event.url,
		'Google sign-in failed. Please try again.'
	);
	return { oauthError };
}

export function signInEmailAction(role: LoginRole) {
	return async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!email || !password) {
			return fail(400, { message: 'Enter your email and password.' });
		}

		let userId: string;
		let sessionToken: string;
		try {
			const result = await auth.api.signInEmail({
				body: { email, password },
				headers: event.request.headers,
				asResponse: false
			});
			userId = result.user.id;
			sessionToken = result.token;
		} catch (error) {
			const failure = describeAuthError('login.signIn', error, 'Login failed. Please try again.');
			return fail(failure.status, { message: failure.message });
		}

		const destination = await destinationForRole(userId, role);
		if (!destination) {
			await discardNewSession(event, sessionToken);
			if (role === 'Therapist') {
				return fail(403, { message: 'This account has no practice set up.' });
			}
			return fail(403, {
				message: 'This account has no client profile. Ask your practitioner for an invite.'
			});
		}
		return redirect(302, destination);
	};
}

export function signInGoogleAction(role: LoginRole) {
	return async (event: RequestEvent) => {
		let url: string;
		try {
			const result = await auth.api.signInSocial({
				body: {
					provider: 'google',
					// role survives the OAuth round-trip so the callback never provisions a
					// therapist profile for someone signing in from the client page
					callbackURL: `/login/google/callback?role=${role}`,
					errorCallbackURL: loginPathFor(role)
				},
				headers: event.request.headers,
				asResponse: false
			});
			if (!result.url) {
				logError('login.google', new Error('signInSocial returned no url'));
				return fail(500, { message: 'Could not start Google sign-in. Please try again.' });
			}
			url = result.url;
		} catch (error) {
			const failure = describeAuthError(
				'login.google',
				error,
				'Could not start Google sign-in. Please try again.'
			);
			return fail(failure.status, { message: failure.message });
		}

		return redirect(302, url);
	};
}
