import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, therapist, user } from '$lib/server/db/schema';
import { sendEmail } from '$lib/server/email';
import { usageLimit } from '$lib/server/billing';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ClientStatus = 'active' | 'paused' | 'left';

export type NewClientInput = {
	name: string;
	email: string;
	age: number | null;
	bio: string | null;
	tags: string[];
	rate: number | null;
};

function buildInviteUrl(origin: string, token: string) {
	return `${origin}/invite/${token}`;
}

async function sendInvite(email: string, url: string) {
	await sendEmail(
		email,
		"You've been invited",
		`<p>Your therapist has invited you to set up your client portal.</p><p><a href="${url}">${url}</a></p>`
	);
}

export async function listClients(therapistId: string) {
	return db.select().from(client).where(eq(client.therapistId, therapistId));
}

// For booking a one-off appointment under a name that isn't an invited client yet
// (e.g. a walk-in). No email/invite — just enough of a row for appointment.clientId to point at.
export async function addWalkInClient(therapistId: string, name: string) {
	const [row] = await db.insert(client).values({ therapistId, name }).returning();
	return row;
}

export async function addClient(therapistId: string, input: NewClientInput, origin: string) {
	const limit = await usageLimit(therapistId, 'clients');
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(client)
		.where(and(eq(client.therapistId, therapistId), isNull(client.deactivatedAt)));
	if (limit !== null && count >= limit) {
		return { error: 'limit_reached' as const };
	}

	const [therapistUser] = await db
		.select({ email: user.email })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(therapist.id, therapistId));
	if (therapistUser && therapistUser.email.toLowerCase() === input.email.toLowerCase()) {
		return { error: 'self' as const };
	}

	const [existing] = await db
		.select()
		.from(client)
		.where(
			and(eq(client.therapistId, therapistId), eq(sql`lower(${client.email})`, input.email.toLowerCase()))
		);
	if (existing) {
		return { error: 'duplicate' as const };
	}

	const inviteToken = randomUUID();
	const [row] = await db
		.insert(client)
		.values({
			therapistId,
			...input,
			inviteToken,
			inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS)
		})
		.returning();

	const inviteUrl = buildInviteUrl(origin, inviteToken);
	await sendInvite(input.email, inviteUrl);

	return { client: row, inviteUrl };
}

export async function resendInvite(therapistId: string, clientId: string, origin: string) {
	const [clientRow] = await db
		.select()
		.from(client)
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));

	if (!clientRow) return { error: 'not_found' as const };
	if (!clientRow.email) return { error: 'no_email' as const };
	if (clientRow.userId) return { error: 'already_joined' as const };

	const inviteToken = randomUUID();
	await db
		.update(client)
		.set({ inviteToken, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS) })
		.where(eq(client.id, clientId));

	const inviteUrl = buildInviteUrl(origin, inviteToken);
	await sendInvite(clientRow.email, inviteUrl);

	return { inviteUrl };
}

export async function deleteClient(therapistId: string, clientId: string) {
	await db.delete(client).where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
}

export async function setClientStatus(therapistId: string, clientId: string, status: ClientStatus) {
	await db
		.update(client)
		.set({ status })
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
}

export async function getInviteByToken(token: string) {
	const [clientRow] = await db.select().from(client).where(eq(client.inviteToken, token));
	if (!clientRow) return { error: 'not_found' as const };
	if (clientRow.userId) return { error: 'already_joined' as const };
	if (!clientRow.inviteExpiresAt || clientRow.inviteExpiresAt < new Date()) {
		return { error: 'expired' as const };
	}
	return { client: clientRow };
}

export async function linkClientToUser(clientId: string, userId: string) {
	await db
		.update(client)
		.set({ userId, inviteToken: null, inviteExpiresAt: null })
		.where(eq(client.id, clientId));
	// the invite link was emailed to this address, so ownership is already proven
	await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
}

export async function listClientsForUser(userId: string) {
	return db
		.select({
			id: client.id,
			name: client.name,
			therapistId: client.therapistId,
			therapistName: user.name,
			therapistSlug: therapist.slug
		})
		.from(client)
		.innerJoin(therapist, eq(client.therapistId, therapist.id))
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(client.userId, userId))
		.orderBy(desc(client.createdAt));
}
