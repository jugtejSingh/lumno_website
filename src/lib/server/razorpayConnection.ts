import { eq, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { therapistRazorpayConnection } from '$lib/server/db/schema';
import { decryptToken, encryptToken } from '$lib/server/tokenCrypto';
import {
	RazorpayOAuthError,
	refreshOAuthToken,
	type OAuthTokenResponse
} from '$lib/server/razorpay';
import { sendRazorpayReconnectEmail } from '$lib/server/reminderEmails';

// The credential vault. Application code calls getAccessToken(therapistId) and
// gets a usable bearer token; it never reads the connection row directly.
// See docs/razorpay-oauth-system-design.md §4 and §12.5.

const DAY_MS = 24 * 60 * 60 * 1000;
// Razorpay's documented TTLs — used only when the token response omits expires_in.
// Confirm the live values with the partner manager (design doc §11).
const ACCESS_TTL_FALLBACK_MS = 90 * DAY_MS;
const REFRESH_TTL_FALLBACK_MS = 180 * DAY_MS;
// Refresh proactively once the access token has less than this left, not on expiry.
const REFRESH_LEAD_MS = 10 * DAY_MS;
const LEASE_MS = 60 * 1000;

export type ConnectionHealth = 'not_connected' | 'connected' | 'expiring' | 'action_needed';

function accessExpiry(res: OAuthTokenResponse): Date {
	return new Date(Date.now() + (res.expires_in ? res.expires_in * 1000 : ACCESS_TTL_FALLBACK_MS));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Upsert on therapistId — also the reconnect path: overwrites dead tokens and
// resets status / failure count (design doc §13).
export async function storeConnection(
	therapistId: string,
	res: OAuthTokenResponse,
	mode: 'test' | 'live'
): Promise<void> {
	const row = {
		therapistId,
		razorpayAccountId: res.razorpay_account_id,
		mode,
		accessTokenEnc: encryptToken(res.access_token),
		refreshTokenEnc: encryptToken(res.refresh_token),
		publicToken: res.public_token,
		accessExpiresAt: accessExpiry(res),
		refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_FALLBACK_MS),
		status: 'active' as const,
		refreshLockUntil: null,
		refreshFailureCount: 0,
		lastRefreshedAt: new Date(),
		reconnectEmailSentAt: null,
		updatedAt: new Date()
	};
	await db
		.insert(therapistRazorpayConnection)
		.values(row)
		.onConflictDoUpdate({ target: therapistRazorpayConnection.therapistId, set: row });
}

// The load-bearing function. The refresh token rotates on every use, so two
// concurrent refreshes race — one wins, the other burns an invalidated token and
// that therapist is locked out until they re-consent. The row lease below is the
// single-flight guard (design doc §4.2). Row-level so it survives multi-instance.
export async function getAccessToken(therapistId: string): Promise<string> {
	const [cred] = await db
		.select()
		.from(therapistRazorpayConnection)
		.where(eq(therapistRazorpayConnection.therapistId, therapistId));

	if (!cred || cred.status !== 'active') {
		throw new Error(`therapist ${therapistId} has no active Razorpay connection`);
	}

	if (cred.accessExpiresAt.getTime() > Date.now() + REFRESH_LEAD_MS) {
		return decryptToken(cred.accessTokenEnc);
	}

	// Lease is set with DB time (now() + LEASE), not app time, so it can't drift
	// against the `< now()` check when the app and DB clocks disagree.
	const leased = await db
		.update(therapistRazorpayConnection)
		.set({ refreshLockUntil: sql`now() + make_interval(secs => ${LEASE_MS / 1000})` })
		.where(
			sql`${therapistRazorpayConnection.therapistId} = ${therapistId}
				and (${therapistRazorpayConnection.refreshLockUntil} is null
					or ${therapistRazorpayConnection.refreshLockUntil} < now())`
		)
		.returning();

	if (leased.length === 0) {
		// Someone else is refreshing. Back off and re-read rather than racing.
		await sleep(500 + Math.random() * 1500);
		return getAccessToken(therapistId);
	}

	// The row `cred` above was read BEFORE we held the lease — another request may
	// have finished a refresh and released the lock in that gap, leaving cred's
	// tokens stale. Work off the post-lease row instead.
	const [locked] = leased;
	if (locked.accessExpiresAt.getTime() > Date.now() + REFRESH_LEAD_MS) {
		await db
			.update(therapistRazorpayConnection)
			.set({ refreshLockUntil: null })
			.where(eq(therapistRazorpayConnection.therapistId, therapistId));
		return decryptToken(locked.accessTokenEnc);
	}

	try {
		const res = await refreshOAuthToken(decryptToken(locked.refreshTokenEnc));
		// Persist BOTH rotated tokens before returning.
		await db
			.update(therapistRazorpayConnection)
			.set({
				accessTokenEnc: encryptToken(res.access_token),
				refreshTokenEnc: encryptToken(res.refresh_token),
				publicToken: res.public_token,
				accessExpiresAt: accessExpiry(res),
				refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_FALLBACK_MS),
				refreshFailureCount: 0,
				lastRefreshedAt: new Date(),
				refreshLockUntil: null
			})
			.where(eq(therapistRazorpayConnection.therapistId, therapistId));
		return res.access_token;
	} catch (err) {
		// A 4xx means the refresh token is dead. No retry helps — the therapist
		// must re-consent. Anything else (5xx, timeout) leaves status alone so the
		// next caller tries again.
		const tokenDead = err instanceof RazorpayOAuthError && err.isClientError;
		const failureUpdate: PgUpdateSetSource<typeof therapistRazorpayConnection> = {
			refreshFailureCount: sql`${therapistRazorpayConnection.refreshFailureCount} + 1`,
			refreshLockUntil: null
		};
		if (tokenDead) {
			failureUpdate.status = 'refresh_failed';
		}
		await db
			.update(therapistRazorpayConnection)
			.set(failureUpdate)
			.where(eq(therapistRazorpayConnection.therapistId, therapistId));
		if (tokenDead) {
			await sendRazorpayReconnectEmail(therapistId, 'refresh_failed');
		}
		throw err;
	}
}

// Therapist disconnected, or an authorization_revoked webhook (design doc §12.10).
// The portal gates "Pay now" on connection status alone, so this is the only
// write needed.
export async function disconnect(therapistId: string): Promise<void> {
	await db
		.update(therapistRazorpayConnection)
		.set({ status: 'revoked' })
		.where(eq(therapistRazorpayConnection.therapistId, therapistId));
}

// account.app.authorization_revoked webhook — Razorpay tells us the therapist
// pulled our access. Look the connection up by account id, revoke it, nudge them
// to reconnect (design doc §12.10). No-op if we don't recognise the account.
export async function revokeConnectionByAccountId(razorpayAccountId: string): Promise<void> {
	const [conn] = await db
		.select({ therapistId: therapistRazorpayConnection.therapistId })
		.from(therapistRazorpayConnection)
		.where(eq(therapistRazorpayConnection.razorpayAccountId, razorpayAccountId));
	if (!conn) {
		return;
	}
	await disconnect(conn.therapistId);
	await sendRazorpayReconnectEmail(conn.therapistId, 'revoked');
}

// Drives the settings banner (design doc §13.1).
export async function connectionHealth(therapistId: string): Promise<ConnectionHealth> {
	const [cred] = await db
		.select({
			status: therapistRazorpayConnection.status,
			refreshExpiresAt: therapistRazorpayConnection.refreshExpiresAt
		})
		.from(therapistRazorpayConnection)
		.where(eq(therapistRazorpayConnection.therapistId, therapistId));

	if (!cred) {
		return 'not_connected';
	}
	if (cred.status === 'refresh_failed' || cred.status === 'revoked') {
		return 'action_needed';
	}
	if (cred.refreshExpiresAt.getTime() < Date.now() + 30 * DAY_MS) {
		return 'expiring';
	}
	return 'connected';
}

// Cron entry point (design doc §12.7), called from GET /api/cron/reminders.
// Refreshes tokens BEFORE the checkout path would have to, so a therapist who
// never takes a payment still keeps a live token as long as the cron runs.
// getAccessToken does the locked refresh and, on a dead token, records the
// failure and emails the therapist — so failures here just get logged.
export async function refreshExpiringConnections(): Promise<void> {
	const due = await db
		.select({ therapistId: therapistRazorpayConnection.therapistId })
		.from(therapistRazorpayConnection)
		.where(
			sql`${therapistRazorpayConnection.status} = 'active'
				and ${therapistRazorpayConnection.accessExpiresAt} < now() + make_interval(secs => ${REFRESH_LEAD_MS / 1000})`
		);

	for (const row of due) {
		try {
			await getAccessToken(row.therapistId);
		} catch (err) {
			console.error(`refreshExpiringConnections: ${row.therapistId} failed:`, err);
		}
	}
}
