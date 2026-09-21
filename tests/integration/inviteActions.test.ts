import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { isActionFailure, isRedirect } from '@sveltejs/kit';

// better-auth is replaced: these tests check what the invite actions do around it
// (validation order, what gets saved), not the auth library itself.
const signUpEmail = vi.fn();
const signInEmail = vi.fn();
const signInSocial = vi.fn();
vi.mock('$lib/server/auth', () => ({
	auth: { api: { signUpEmail, signInEmail, signInSocial } }
}));

const { db } = await import('$lib/server/db');
const { client } = await import('$lib/server/db/schema');
const { load, actions } = await import('../../src/routes/invite/[token]/+page.server');
const { resetDb, mkTherapist, mkClient, mkUser, mkEvent } = await import('./helpers');

const TOKEN = 'invite-token-123';
const INVITE_EMAIL = 'invited@example.com';

let clientId: string;

const validProfile = {
	dateOfBirth: '1990-04-12',
	gender: 'Female',
	city: 'Pune',
	state: 'Maharashtra',
	country: 'IN'
};

function post(action: keyof typeof actions, fields: Record<string, string>, locals: Record<string, unknown> = {}) {
	return actions[action](
		mkEvent({ locals, fields, params: { token: TOKEN }, url: `http://localhost/invite/${TOKEN}` }) as never
	);
}

// runs an action that should redirect, returning where to
async function redirectTarget(promise: unknown): Promise<string> {
	try {
		const result = await promise;
		throw new Error(`expected a redirect, got ${JSON.stringify(result)}`);
	} catch (err) {
		if (!isRedirect(err)) {
			throw err;
		}
		return err.location;
	}
}

async function clientRow() {
	const [row] = await db.select().from(client).where(eq(client.id, clientId));
	return row;
}

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	const t = await mkTherapist();
	clientId = (
		await mkClient(t.id, {
			email: INVITE_EMAIL,
			inviteToken: TOKEN,
			inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
		})
	).id;
});

describe('invite load', () => {
	it('asks for the profile until the client row has one', async () => {
		const before = (await load(mkEvent({ params: { token: TOKEN }, url: `http://localhost/invite/${TOKEN}` }) as never)) as {
			needsProfile: boolean;
		};
		expect(before.needsProfile).toBe(true);

		await db.update(client).set(validProfile).where(eq(client.id, clientId));
		const after = (await load(mkEvent({ params: { token: TOKEN }, url: `http://localhost/invite/${TOKEN}` }) as never)) as {
			needsProfile: boolean;
		};
		expect(after.needsProfile).toBe(false);
	});
});

describe('password action', () => {
	it('rejects a bad profile before any account is created or signed in', async () => {
		const result = await post('password', { password: 'hunter22hunter', ...validProfile, dateOfBirth: '' });
		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: unknown }).data).toEqual({ message: 'Enter your date of birth.' });
		expect(signUpEmail).not.toHaveBeenCalled();
		expect(signInEmail).not.toHaveBeenCalled();
		expect((await clientRow()).userId).toBeNull();
	});

	it('rejects a bad phone before any account is created', async () => {
		const result = await post('password', { password: 'hunter22hunter', ...validProfile, phone: 'not-a-phone' });
		expect(isActionFailure(result)).toBe(true);
		expect(signUpEmail).not.toHaveBeenCalled();
	});

	it('signs up, links the client, saves the profile and phone, and goes to the portal', async () => {
		// no user with the invited email yet, so the action signs up; the mock creates the row
		let createdId = '';
		signUpEmail.mockImplementation(async () => {
			const created = await mkUser({ email: INVITE_EMAIL });
			createdId = created.id;
			return { user: { id: created.id } };
		});

		const location = await redirectTarget(
			post('password', { password: 'hunter22hunter', ...validProfile, phone: '+919876543210' })
		);
		expect(location).toBe('/portal');
		expect(signUpEmail).toHaveBeenCalledOnce();

		const row = await clientRow();
		expect(row.userId).toBe(createdId);
		expect(row.inviteToken).toBeNull();
		expect(row).toMatchObject({ ...validProfile, phone: '+919876543210' });
	});

	it('signs an existing user in instead of signing up', async () => {
		const existing = await mkUser({ email: INVITE_EMAIL });
		signInEmail.mockResolvedValue({ user: { id: existing.id } });

		expect(await redirectTarget(post('password', { password: 'hunter22hunter', ...validProfile }))).toBe('/portal');
		expect(signInEmail).toHaveBeenCalledOnce();
		expect(signUpEmail).not.toHaveBeenCalled();
		expect((await clientRow()).userId).toBe(existing.id);
	});

	it('refuses an expired invite', async () => {
		await db.update(client).set({ inviteExpiresAt: new Date(Date.now() - 1000) }).where(eq(client.id, clientId));
		const result = await post('password', { password: 'hunter22hunter', ...validProfile });
		expect((result as { data: unknown }).data).toEqual({ message: 'This invite is no longer valid.' });
		expect(signUpEmail).not.toHaveBeenCalled();
	});
});

describe('google action', () => {
	it('rejects a bad profile before starting Google sign-in', async () => {
		const result = await post('google', { ...validProfile, country: 'ZZZ' });
		expect(isActionFailure(result)).toBe(true);
		expect(signInSocial).not.toHaveBeenCalled();
	});

	it('saves the profile before handing off to Google, then redirects there', async () => {
		signInSocial.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/auth?x=1' });
		const location = await redirectTarget(post('google', validProfile));
		expect(location).toBe('https://accounts.google.com/o/oauth2/auth?x=1');
		expect(await clientRow()).toMatchObject(validProfile);
		// not linked yet — that happens in acceptAsSelf once Google sends them back
		expect((await clientRow()).userId).toBeNull();
	});
});

describe('acceptAsSelf', () => {
	it('refuses a user whose email is not the invited one', async () => {
		const stranger = await mkUser({ email: 'someone-else@example.com' });
		const result = await post('acceptAsSelf', validProfile, { user: stranger });
		expect((result as { status: number }).status).toBe(403);
		expect((await clientRow()).userId).toBeNull();
	});

	it('refuses when not signed in', async () => {
		const result = await post('acceptAsSelf', validProfile);
		expect((result as { status: number }).status).toBe(403);
	});

	it('requires a valid profile when the row has none yet', async () => {
		const invited = await mkUser({ email: INVITE_EMAIL });
		const result = await post('acceptAsSelf', {}, { user: invited });
		expect(isActionFailure(result)).toBe(true);
		expect((await clientRow()).userId).toBeNull();
	});

	it('links without asking again when the profile was already saved (back from Google)', async () => {
		await db.update(client).set(validProfile).where(eq(client.id, clientId));
		const invited = await mkUser({ email: INVITE_EMAIL });

		expect(await redirectTarget(post('acceptAsSelf', {}, { user: invited }))).toBe('/portal');
		const row = await clientRow();
		expect(row.userId).toBe(invited.id);
		expect(row).toMatchObject(validProfile);
	});

	it('saves the profile and links when collected here', async () => {
		const invited = await mkUser({ email: INVITE_EMAIL });
		expect(await redirectTarget(post('acceptAsSelf', validProfile, { user: invited }))).toBe('/portal');
		expect(await clientRow()).toMatchObject({ ...validProfile, userId: invited.id });
	});
});
