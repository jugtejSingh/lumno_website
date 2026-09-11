import { APIError } from 'better-auth/api';
import { logError } from '$lib/server/log';

// Every auth failure shown to a user comes through here so the wording can't
// leak whether an email exists. Wrong email and wrong password collapse into
// one line; anything unrecognised gets a generic line and a server log.
export const GENERIC_SIGN_IN_MESSAGE =
	'Either the email or password is incorrect, or the account is not in our system.';

const SAFE_MESSAGES: Record<string, string> = {
	INVALID_EMAIL_OR_PASSWORD: GENERIC_SIGN_IN_MESSAGE,
	INVALID_EMAIL: 'Please enter a valid email address.',
	INVALID_PASSWORD: GENERIC_SIGN_IN_MESSAGE,
	EMAIL_NOT_VERIFIED: 'Please verify your email first — we just sent you a new verification link.',
	PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
	PASSWORD_TOO_LONG: 'Password is too long.',
	// better-auth refuses to reveal a taken email on signup by default; if it ever
	// does surface, keep the same neutral line the login form uses.
	USER_ALREADY_EXISTS: GENERIC_SIGN_IN_MESSAGE,
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: GENERIC_SIGN_IN_MESSAGE
};

// What better-auth's OAuth callback appends as ?error= when a Google sign-in or
// account link fails part-way. Anything not listed gets the fallback — the raw
// code is logged, never shown.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
	access_denied: 'Google sign-in was cancelled.',
	state_not_found: 'That sign-in attempt expired. Please try again.',
	state_mismatch: 'That sign-in attempt expired. Please try again.',
	email_not_verified: 'Your Google account email is not verified.',
	email_doesnt_match: 'That Google account uses a different email than this account.',
	account_already_linked_to_different_user:
		'That Google account is already connected to a different Lumno account.',
	signup_disabled: 'Sign-ups are not open right now.',
	// ours, not better-auth's: set by /login/google/callback when "Client" was picked
	no_client_profile: 'This account has no client profile. Ask your therapist for an invite.'
};

// Reads ?error= / ?error_description= off a page URL; null when there is none.
export function describeOAuthError(
	scope: string,
	url: URL,
	fallback: string,
	context: Record<string, unknown> = {}
): string | null {
	const code = url.searchParams.get('error');
	if (!code) {
		return null;
	}
	logError(scope, new Error(`oauth callback error: ${code}`), {
		...context,
		description: url.searchParams.get('error_description')
	});
	return OAUTH_ERROR_MESSAGES[code] ?? fallback;
}

export type AuthFailure = { status: number; message: string };

export function describeAuthError(scope: string, err: unknown, fallback: string): AuthFailure {
	if (err instanceof APIError) {
		const code = err.body?.code ?? '';
		if (err.statusCode === 429) {
			return { status: 429, message: 'Too many attempts. Please wait a minute and try again.' };
		}
		const safe = SAFE_MESSAGES[code];
		if (safe) {
			// 4xx expected failures are not worth a stack trace; a bare info line
			// keeps brute-force attempts visible in the logs without noise.
			return { status: 400, message: safe };
		}
		logError(scope, err, { code, statusCode: err.statusCode });
		return { status: 400, message: fallback };
	}
	logError(scope, err);
	return { status: 500, message: 'Something went wrong on our side. Please try again.' };
}
