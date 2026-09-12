import { error, redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { randomUUID } from 'node:crypto';
import { logError } from '$lib/server/log';
import { eq } from 'drizzle-orm';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { therapist } from '$lib/server/db/schema';
import { listClientsForUser } from '$lib/server/clients';
import { ACTIVE_CLIENT_COOKIE, setActiveClientCookie } from '$lib/server/activeClient';
import { ratelimit } from '$lib/server/rateLimit';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Server-to-server callbacks that verify their own signature/secret and can
// legitimately retry fast — IP throttling them only risks dropping a retry.
const RATE_LIMIT_EXEMPT_PREFIXES = ['/webhooks/', '/api/cron/'];

const handleRateLimit: Handle = async ({ event, resolve }) => {
	const isExempt = RATE_LIMIT_EXEMPT_PREFIXES.some((prefix) =>
		event.url.pathname.startsWith(prefix)
	);
	if (!isExempt) {
		const { success } = await ratelimit.limit(event.getClientAddress());
		if (!success) {
			error(429, 'Too many requests. Please try again shortly.');
		}
	}
	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		// only needed under (app); actions there run before layout `load`, so it
		// must be set here rather than in (app)/+layout.server.ts
		if (event.route.id?.startsWith('/(app)')) {
			const [therapistRow] = await db
				.select()
				.from(therapist)
				.where(eq(therapist.userId, session.user.id));
			if (therapistRow) {
				event.locals.therapistId = therapistRow.id;
				event.locals.therapist = therapistRow;
			}
		}

		// same deal for (portal): a user can be a client of multiple therapists, so
		// pick whichever one is "active". Defaults to the newest, remembered via cookie
		// once a switcher lets them pick a different one.
		if (event.route.id?.startsWith('/(portal)')) {
			const clientRows = await listClientsForUser(session.user.id);

			// requestedId only picks an active client if it's actually one of this
			// user's own rows — never trust the cookie value on its own.
			const requestedId = event.cookies.get(ACTIVE_CLIENT_COOKIE);
			const activeClient = clientRows.find((row) => row.id === requestedId) ?? clientRows[0];

			if (activeClient) {
				event.locals.clientId = activeClient.id;
				if (activeClient.id !== requestedId) {
					setActiveClientCookie(event.cookies, activeClient.id);
				}
			}
		}
	}

	// Single gate for everything under (app) — pages, actions, and standalone
	// +server.ts endpoints alike (layout `load` doesn't run for the last two).
	// Downstream (app) code can treat locals.therapistId as non-null.
	if (event.route.id?.startsWith('/(app)') && !event.locals.therapistId) {
		redirect(302, event.locals.user ? '/portal' : '/login');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleRateLimit, handleBetterAuth);

// Every uncaught throw in a load/action/endpoint lands here. The full error goes
// to the server log with a short id; the user only ever sees the id and a generic
// line — never the message, which could leak SQL, env names or internal ids.
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const errorId = randomUUID().slice(0, 8);
	logError('unhandled', error, {
		errorId,
		status,
		route: event.route.id,
		method: event.request.method,
		url: event.url.pathname,
		userId: event.locals.user?.id
	});
	if (status === 404) {
		return { message: 'Page not found' };
	}
	return { message: `${message || 'Something went wrong'} (ref ${errorId})` };
};
