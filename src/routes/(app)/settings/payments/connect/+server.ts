import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { therapist } from '$lib/server/db/schema';
import { razorpayOAuthConfig } from '$lib/server/razorpay';

// Therapist auth is enforced in hooks.server.ts for the whole (app) group.

// CSRF: a random nonce in an httpOnly cookie, compared on callback (double-submit).
// It's inherently bound to the logged-in therapist's session, so no state table
// (design doc §12.2). sameSite: 'lax' so it survives the Razorpay round-trip.
export const _OAUTH_STATE_COOKIE = 'rzp_oauth_state';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const therapistId = locals.therapistId!;

	const [row] = await db
		.select({ currency: therapist.currency })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	if (row?.currency !== 'INR') {
		redirect(302, '/settings?payments=not_inr');
	}

	const state = randomBytes(32).toString('hex');
	// `secure` is left to SvelteKit's default (true, except on http://localhost) so
	// the round-trip also works against a local dev server.
	cookies.set(_OAUTH_STATE_COOKIE, state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600
	});

	const { clientId, redirectUri } = razorpayOAuthConfig();
	// Built by hand rather than URLSearchParams so scope[] stays literal and
	// redirect_uri byte-matches the token-exchange call (design doc §3.1, §12.6).
	const authorizeUrl =
		'https://auth.razorpay.com/authorize' +
		`?client_id=${encodeURIComponent(clientId)}` +
		'&response_type=code' +
		`&redirect_uri=${encodeURIComponent(redirectUri)}` +
		'&scope[]=read_write' +
		`&state=${state}`;
	redirect(302, authorizeUrl);
};
