import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { isRedirect } from '@sveltejs/kit';

process.env.TOKEN_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.RAZORPAY_OAUTH_CLIENT_ID = 'test_client';
process.env.RAZORPAY_OAUTH_CLIENT_SECRET = 'test_secret';
process.env.RAZORPAY_OAUTH_REDIRECT_URI = 'https://app.test/settings/payments/connect/callback';

// Keep the real RazorpayOAuthError / config; stub only the two network calls.
const refreshMock = vi.fn();
const exchangeMock = vi.fn();
vi.mock('$lib/server/razorpay', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/razorpay')>();
	return { ...actual, refreshOAuthToken: refreshMock, exchangeOAuthCode: exchangeMock };
});

// The refresh-failure path emails the therapist; don't hit the mailer in tests.
const reconnectEmailMock = vi.fn();
vi.mock('$lib/server/reminderEmails', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/reminderEmails')>();
	return { ...actual, sendRazorpayReconnectEmail: reconnectEmailMock };
});

const { encryptToken, decryptToken } = await import('$lib/server/tokenCrypto');
const { RazorpayOAuthError } = await import('$lib/server/razorpay');
const {
	getAccessToken,
	storeConnection,
	connectionHealth,
	disconnect,
	refreshExpiringConnections
} = await import('$lib/server/razorpayConnection');
const { db } = await import('$lib/server/db');
const { therapistRazorpayConnection } = await import('$lib/server/db/schema');
const { GET: callbackGet } =
	await import('../../src/routes/(app)/settings/payments/connect/callback/+server');
const { resetDb, mkTherapist } = await import('./helpers');

function tokenResponse(overrides: Record<string, unknown> = {}) {
	return {
		access_token: `acc_${Math.random()}`,
		refresh_token: `ref_${Math.random()}`,
		public_token: 'rzp_test_oauth_pub',
		expires_in: 90 * 24 * 60 * 60,
		razorpay_account_id: 'acc_TEST123',
		...overrides
	};
}

let therapistId: string;

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist()).id;
	refreshMock.mockReset();
	exchangeMock.mockReset();
});

describe('tokenCrypto', () => {
	it('round-trips a token', () => {
		const blob = encryptToken('super-secret-access-token');
		expect(blob).not.toContain('super-secret');
		expect(decryptToken(blob)).toBe('super-secret-access-token');
	});

	it('rejects a tampered auth tag', () => {
		const [iv, , ct] = encryptToken('x').split('.');
		const forgedTag = Buffer.alloc(16, 0).toString('base64');
		expect(() => decryptToken(`${iv}.${forgedTag}.${ct}`)).toThrow();
	});
});

describe('getAccessToken', () => {
	it('returns the stored token without refreshing when it is fresh', async () => {
		await storeConnection(therapistId, tokenResponse({ access_token: 'fresh' }), 'test');
		expect(await getAccessToken(therapistId)).toBe('fresh');
		expect(refreshMock).not.toHaveBeenCalled();
	});

	it('proactively refreshes and persists both rotated tokens', async () => {
		await storeConnection(therapistId, tokenResponse({ expires_in: 5 }), 'test');
		refreshMock.mockResolvedValue(
			tokenResponse({ access_token: 'new-acc', refresh_token: 'new-ref' })
		);

		expect(await getAccessToken(therapistId)).toBe('new-acc');

		const [row] = await db
			.select()
			.from(therapistRazorpayConnection)
			.where(eq(therapistRazorpayConnection.therapistId, therapistId));
		expect(decryptToken(row.accessTokenEnc)).toBe('new-acc');
		expect(decryptToken(row.refreshTokenEnc)).toBe('new-ref');
		expect(row.refreshLockUntil).toBeNull();
		expect(row.accessExpiresAt.getTime()).toBeGreaterThan(Date.now() + 80 * 24 * 60 * 60 * 1000);
	});

	it('single-flights concurrent refreshes via the row lease', async () => {
		await storeConnection(therapistId, tokenResponse({ expires_in: 5 }), 'test');
		refreshMock.mockImplementation(async () => {
			await new Promise((r) => setTimeout(r, 50));
			return tokenResponse();
		});

		await Promise.all([getAccessToken(therapistId), getAccessToken(therapistId)]);

		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it('marks the connection refresh_failed on a 4xx and does not retry', async () => {
		await storeConnection(therapistId, tokenResponse({ expires_in: 5 }), 'test');
		refreshMock.mockRejectedValue(new RazorpayOAuthError(400));

		await expect(getAccessToken(therapistId)).rejects.toThrow(RazorpayOAuthError);
		expect(refreshMock).toHaveBeenCalledTimes(1);

		const [row] = await db
			.select()
			.from(therapistRazorpayConnection)
			.where(eq(therapistRazorpayConnection.therapistId, therapistId));
		expect(row.status).toBe('refresh_failed');
		expect(row.refreshFailureCount).toBe(1);
	});
});

describe('refreshExpiringConnections', () => {
	it('refreshes a near-expiry active connection and leaves a fresh one alone', async () => {
		const staleId = therapistId;
		await storeConnection(staleId, tokenResponse({ expires_in: 5 }), 'test');

		const freshTherapist = (await mkTherapist()).id;
		await storeConnection(freshTherapist, tokenResponse({ access_token: 'still-fresh' }), 'test');

		refreshMock.mockResolvedValue(tokenResponse({ access_token: 'cron-refreshed' }));

		await refreshExpiringConnections();

		expect(refreshMock).toHaveBeenCalledTimes(1);
		const [row] = await db
			.select()
			.from(therapistRazorpayConnection)
			.where(eq(therapistRazorpayConnection.therapistId, staleId));
		expect(decryptToken(row.accessTokenEnc)).toBe('cron-refreshed');
	});

	it('swallows a dead-token failure and marks that connection refresh_failed', async () => {
		await storeConnection(therapistId, tokenResponse({ expires_in: 5 }), 'test');
		refreshMock.mockRejectedValue(new RazorpayOAuthError(400));

		await expect(refreshExpiringConnections()).resolves.toBeUndefined();

		const [row] = await db
			.select()
			.from(therapistRazorpayConnection)
			.where(eq(therapistRazorpayConnection.therapistId, therapistId));
		expect(row.status).toBe('refresh_failed');
	});
});

describe('connectionHealth / disconnect', () => {
	it('reports not_connected, then connected, then action_needed', async () => {
		expect(await connectionHealth(therapistId)).toBe('not_connected');

		await storeConnection(therapistId, tokenResponse(), 'test');
		expect(await connectionHealth(therapistId)).toBe('connected');

		await disconnect(therapistId);
		expect(await connectionHealth(therapistId)).toBe('action_needed');
	});
});

describe('OAuth callback', () => {
	function event(query: string, cookieState: string | undefined) {
		const deleted: string[] = [];
		return {
			locals: { therapistId },
			url: new URL(`https://app.test/settings/payments/connect/callback${query}`),
			cookies: {
				get: () => cookieState,
				delete: (name: string) => deleted.push(name)
			}
		} as unknown as Parameters<typeof callbackGet>[0];
	}

	async function locationOf(promise: unknown): Promise<string> {
		try {
			await promise;
		} catch (e) {
			if (isRedirect(e)) return e.location;
			throw e;
		}
		throw new Error('expected a redirect');
	}

	it('rejects a state mismatch', async () => {
		const loc = await locationOf(callbackGet(event('?code=abc&state=xxx', 'yyy')));
		expect(loc).toBe('/settings?payments=state_error');
		expect(exchangeMock).not.toHaveBeenCalled();
	});

	it('stores an encrypted connection row on the happy path', async () => {
		exchangeMock.mockResolvedValue(tokenResponse({ access_token: 'from-exchange' }));

		const loc = await locationOf(callbackGet(event('?code=abc&state=match', 'match')));
		expect(loc).toBe('/settings?payments=connected');

		const [row] = await db
			.select()
			.from(therapistRazorpayConnection)
			.where(eq(therapistRazorpayConnection.therapistId, therapistId));
		expect(row.razorpayAccountId).toBe('acc_TEST123');
		expect(row.accessTokenEnc).not.toContain('from-exchange');
		expect(decryptToken(row.accessTokenEnc)).toBe('from-exchange');
	});
});
