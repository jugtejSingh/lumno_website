import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, user } from '$lib/server/db/schema';
import {
	addClient,
	resendInvite,
	getInviteByToken,
	linkClientToUser,
	setClientStatus,
	deleteClient,
	listClients,
	listClientsForUser,
	setClientProfile,
	getClientCustomFields,
	type NewClientInput
} from '$lib/server/clients';
import { sendEmail } from '$lib/server/email';
import { resetDb, mkTherapist, mkClient, mkUser } from './helpers';

const newClientInput = (over: Partial<NewClientInput> = {}): NewClientInput => ({
	name: 'Sam Client',
	email: 'sam@example.com',
	customFields: {},
	tags: [],
	rate: 1200,
	...over
});

let therapistId: string;

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	therapistId = (await mkTherapist()).id;
});

describe('addClient', () => {
	it('creates the client, sets an invite token, and emails the invite', async () => {
		const res = await addClient(therapistId, newClientInput(), 'https://app.test');
		expect(res).toMatchObject({ client: { email: 'sam@example.com' } });
		expect(res.client!.inviteToken).toBeTruthy();
		expect(res.inviteUrl).toBe(`https://app.test/invite/${res.client!.inviteToken}`);
		expect(sendEmail).toHaveBeenCalledWith(
			'sam@example.com',
			expect.any(String),
			expect.any(String),
			expect.objectContaining({ text: expect.any(String), replyTo: expect.any(String) })
		);
	});

	it('rejects the therapist inviting their own email', async () => {
		const t = await mkTherapist();
		expect(
			await addClient(t.id, newClientInput({ email: t.user.email.toUpperCase() }), 'https://app.test')
		).toEqual({ error: 'self' });
	});

	it('rejects a duplicate email on the same therapist, case-insensitively', async () => {
		await addClient(therapistId, newClientInput({ email: 'dup@example.com' }), 'https://app.test');
		expect(
			await addClient(therapistId, newClientInput({ email: 'DUP@example.com' }), 'https://app.test')
		).toEqual({ error: 'duplicate' });
	});
});

describe('resendInvite', () => {
	it('errors for another therapist’s client', async () => {
		const c = await mkClient(therapistId, { email: 'x@example.com' });
		const other = await mkTherapist();
		expect(await resendInvite(other.id, c.id, 'https://app.test')).toEqual({ error: 'not_found' });
	});

	it('errors when the client has no email', async () => {
		const c = await mkClient(therapistId, { email: null });
		expect(await resendInvite(therapistId, c.id, 'https://app.test')).toEqual({ error: 'no_email' });
	});

	it('errors when the client already joined', async () => {
		const u = await mkUser();
		const c = await mkClient(therapistId, { email: 'x@example.com', userId: u.id });
		expect(await resendInvite(therapistId, c.id, 'https://app.test')).toEqual({
			error: 'already_joined'
		});
	});

	it('rotates the token and re-sends', async () => {
		const { client: c } = await addClient(
			therapistId,
			newClientInput({ email: 'r@example.com' }),
			'https://app.test'
		);
		const res = await resendInvite(therapistId, c!.id, 'https://app.test');
		expect('inviteUrl' in res).toBe(true);
		const [after] = await db.select().from(client).where(eq(client.id, c!.id));
		expect(after.inviteToken).not.toBe(c!.inviteToken);
	});
});

describe('getInviteByToken / linkClientToUser', () => {
	it('not_found for an unknown token', async () => {
		expect(await getInviteByToken('nope')).toEqual({ error: 'not_found' });
	});

	it('expired when inviteExpiresAt is in the past', async () => {
		const c = await mkClient(therapistId, {
			email: 'e@example.com',
			inviteToken: 'tok-expired',
			inviteExpiresAt: new Date(Date.now() - 1000)
		});
		expect(await getInviteByToken('tok-expired')).toEqual({ error: 'expired' });
		expect(c.id).toBeTruthy();
	});

	it('accepts a live token, then linkClientToUser consumes it and verifies the user', async () => {
		const { client: c } = await addClient(
			therapistId,
			newClientInput({ email: 'live@example.com' }),
			'https://app.test'
		);
		const found = await getInviteByToken(c!.inviteToken!);
		expect('client' in found).toBe(true);

		const u = await mkUser({ email: 'live@example.com', emailVerified: false });
		await linkClientToUser(c!.id, u.id);

		const [linked] = await db.select().from(client).where(eq(client.id, c!.id));
		expect(linked).toMatchObject({ userId: u.id, inviteToken: null, inviteExpiresAt: null });
		const [uRow] = await db.select().from(user).where(eq(user.id, u.id));
		expect(uRow.emailVerified).toBe(true);

		expect(await getInviteByToken(c!.inviteToken!)).toEqual({ error: 'not_found' });
	});
});

describe('status, delete, and per-user listing', () => {
	it('setClientStatus and deleteClient are scoped to the owning therapist', async () => {
		const c = await mkClient(therapistId);
		const other = await mkTherapist();

		await setClientStatus(other.id, c.id, 'left');
		expect((await listClients(therapistId))[0].status).toBe('active');

		await setClientStatus(therapistId, c.id, 'paused');
		expect((await listClients(therapistId))[0].status).toBe('paused');

		await deleteClient(other.id, c.id);
		expect(await listClients(therapistId)).toHaveLength(1);
		await deleteClient(therapistId, c.id);
		expect(await listClients(therapistId)).toHaveLength(0);
	});

	it('listClientsForUser returns every therapist a user is a client of', async () => {
		const u = await mkUser();
		const t2 = await mkTherapist();
		await mkClient(therapistId, { userId: u.id });
		await mkClient(t2.id, { userId: u.id });

		const rows = await listClientsForUser(u.id);
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.therapistId).sort()).toEqual([therapistId, t2.id].sort());
	});
});

describe('setClientProfile', () => {
	it('writes all five profile fields and nothing else', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id, { customFields: { note: 'private' }, rate: 1500 });
		await setClientProfile(c.id, {
			dateOfBirth: '1990-04-12',
			gender: 'Woman',
			city: 'Pune',
			state: 'Maharashtra',
			country: 'IN'
		});

		const [row] = await db.select().from(client).where(eq(client.id, c.id));
		expect(row).toMatchObject({
			dateOfBirth: '1990-04-12',
			gender: 'Woman',
			city: 'Pune',
			state: 'Maharashtra',
			country: 'IN',
			customFields: { note: 'private' },
			rate: 1500
		});
	});

	it('only touches the given client', async () => {
		const t = await mkTherapist();
		const target = await mkClient(t.id);
		const bystander = await mkClient(t.id, { name: 'Other Client' });
		await setClientProfile(target.id, { dateOfBirth: '1990-04-12', gender: 'Man', city: 'X', state: 'Y', country: 'GB' });

		const [row] = await db.select().from(client).where(eq(client.id, bystander.id));
		expect(row.city).toBeNull();
	});
});

describe('getClientCustomFields', () => {
	it('returns the client’s custom fields for their own therapist', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id, { customFields: { h1: 'anxious about exams' } });
		expect(await getClientCustomFields(t.id, c.id)).toEqual({ h1: 'anxious about exams' });
	});

	it('returns null for another therapist’s client', async () => {
		const mine = await mkTherapist();
		const theirs = await mkTherapist();
		const c = await mkClient(theirs.id, { customFields: { h1: 'secret' } });
		expect(await getClientCustomFields(mine.id, c.id)).toBeNull();
	});

	it('returns null for a client that does not exist', async () => {
		const t = await mkTherapist();
		expect(await getClientCustomFields(t.id, 'no-such-client')).toBeNull();
	});
});
