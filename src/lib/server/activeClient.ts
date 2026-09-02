import type { Cookies } from '@sveltejs/kit';

// which client row (of possibly several — one per therapist) is active for this session
export const ACTIVE_CLIENT_COOKIE = 'activeClientId';

export function setActiveClientCookie(cookies: Cookies, clientId: string) {
	cookies.set(ACTIVE_CLIENT_COOKIE, clientId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});
}