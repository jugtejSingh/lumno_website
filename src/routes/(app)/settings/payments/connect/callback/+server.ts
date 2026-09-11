import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { therapistRazorpayConnection } from '$lib/server/db/schema';
import {
	exchangeOAuthCode,
	RAZORPAY_OAUTH_MODE,
	type OAuthTokenResponse
} from '$lib/server/razorpay';
import { storeConnection } from '$lib/server/razorpayConnection';
import { _OAUTH_STATE_COOKIE } from '../+server';
import { logError } from '$lib/server/log';

// Therapist auth is enforced in hooks.server.ts for the whole (app) group.
export const GET: RequestHandler = async ({ locals, url, cookies }) => {
	const therapistId = locals.therapistId!;

	const cookieState = cookies.get(_OAUTH_STATE_COOKIE);
	cookies.delete(_OAUTH_STATE_COOKIE, { path: '/' }); // single use

	if (url.searchParams.get('error')) {
		redirect(302, '/settings?payments=declined');
	}

	const state = url.searchParams.get('state');
	const code = url.searchParams.get('code');
	if (!code || !state || !cookieState || state !== cookieState) {
		redirect(302, '/settings?payments=state_error');
	}

	const [existing] = await db
		.select({ razorpayAccountId: therapistRazorpayConnection.razorpayAccountId })
		.from(therapistRazorpayConnection)
		.where(eq(therapistRazorpayConnection.therapistId, therapistId));

	let tokens: OAuthTokenResponse;
	try {
		tokens = await exchangeOAuthCode(code);
	} catch (err) {
		// RazorpayOAuthError carries only the status — never the code or secret.
		logError('razorpay.oauth.exchange', err, { therapistId });
		redirect(302, '/settings?payments=state_error');
	}

	await storeConnection(therapistId, tokens, RAZORPAY_OAUTH_MODE);

	if (existing && existing.razorpayAccountId !== tokens.razorpay_account_id) {
		// Historic orders stay linked to the old acc_… — warn so it's a conscious
		// choice, not a silent swap (design doc §13.4).
		redirect(302, '/settings?payments=account_changed');
	}
	redirect(302, '/settings?payments=connected');
};
