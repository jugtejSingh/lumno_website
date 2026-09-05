import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, therapist, user } from '$lib/server/db/schema';
import { sendEmail, wrapEmail } from '$lib/server/email';
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

async function sendInvite(email: string, url: string, therapistName: string, therapistEmail: string) {
	await sendEmail(
		email,
		"You've been invited",
		wrapEmail({
			heading: "You're invited",
			bodyHtml: `<p>${therapistName} has invited you to set up your client portal on Lumno.</p><p>Lumno is where you'll book and reschedule sessions, keep track of payments, and get notes and homework your therapist shares with you — all in one place.</p>`,
			cta: { text: 'Set up your portal', url },
			footerNote: `Sent on behalf of ${therapistName}. Reply to this email to reach them directly.`
		}),
		{
			text: `${therapistName} has invited you to set up your client portal.\n${url}`,
			replyTo: therapistEmail
		}
	);
}

export async function listClients(therapistId: string) {
	return db.select().from(client).where(eq(client.therapistId, therapistId));
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
		.select({ email: user.email, name: user.name })
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
			status: 'paused',
			inviteToken,
			inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS)
		})
		.returning();

	const inviteUrl = buildInviteUrl(origin, inviteToken);
	// therapistUser is always found here — therapist.userId is a required FK, checked above
	await sendInvite(input.email, inviteUrl, therapistUser!.name, therapistUser!.email);

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

	const [therapistUser] = await db
		.select({ email: user.email, name: user.name })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(therapist.id, therapistId));

	const inviteToken = randomUUID();
	await db
		.update(client)
		.set({ inviteToken, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS) })
		.where(eq(client.id, clientId));

	const inviteUrl = buildInviteUrl(origin, inviteToken);
	// therapistUser is always found here — therapist.userId is a required FK
	await sendInvite(clientRow.email, inviteUrl, therapistUser!.name, therapistUser!.email);

	return { inviteUrl };
}

export async function deleteClient(therapistId: string, clientId: string) {
	await db.delete(client).where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
}

// 'left' deactivates the client (so they stop counting against the plan cap and stop being
// bookable, same as syncClientActivationForCap's deactivation) — nothing else in this app
// currently sets deactivatedAt for a manual, therapist-driven reason. Moving off 'left'
// reactivates them, but only if there's cap room — same limit addClient enforces, so a
// therapist can't dodge the cap by parking clients as 'left' and pulling them back later.
export async function setClientStatus(therapistId: string, clientId: string, status: ClientStatus) {
	const [current] = await db
		.select({ status: client.status })
		.from(client)
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
	if (!current) return { error: 'not_found' as const };

	if (current.status === 'left' && status !== 'left') {
		const limit = await usageLimit(therapistId, 'clients');
		const [{ count }] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(client)
			.where(and(eq(client.therapistId, therapistId), isNull(client.deactivatedAt)));
		if (limit !== null && count >= limit) {
			return { error: 'limit_reached' as const };
		}
	}

	await db
		.update(client)
		.set({ status, deactivatedAt: status === 'left' ? new Date() : null })
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
	return {};
}

export type ClientUpdateInput = {
	name: string;
	age: number | null;
	bio: string | null;
	tags: string[];
	rate: number | null;
	status: ClientStatus;
};

export async function updateClient(therapistId: string, clientId: string, input: ClientUpdateInput) {
	const [current] = await db
		.select({ status: client.status })
		.from(client)
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
	if (!current) return { error: 'not_found' as const };

	if (current.status === 'left' && input.status !== 'left') {
		const limit = await usageLimit(therapistId, 'clients');
		const [{ count }] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(client)
			.where(and(eq(client.therapistId, therapistId), isNull(client.deactivatedAt)));
		if (limit !== null && count >= limit) {
			return { error: 'limit_reached' as const };
		}
	}

	await db
		.update(client)
		.set({
			name: input.name,
			age: input.age,
			bio: input.bio,
			tags: input.tags,
			rate: input.rate,
			status: input.status,
			deactivatedAt: input.status === 'left' ? new Date() : null
		})
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
	return {};
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
		.set({ userId, status: 'active', inviteToken: null, inviteExpiresAt: null })
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
