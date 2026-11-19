import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, therapist, user } from '$lib/server/db/schema';
import { escapeHtml, sendEmail, wrapEmail } from '$lib/server/email';
import { usageLimit } from '$lib/server/billing';
import { logError } from '$lib/server/log';
import type { ClientFieldValues } from '$lib/types/clientFields';
import type { ClientProfile } from '$lib/clientProfile';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ClientStatus = 'active' | 'paused' | 'left';

export type NewClientInput = {
	name: string;
	email: string;
	customFields: ClientFieldValues;
	rate: number | null;
};

function buildInviteUrl(origin: string, token: string) {
	return `${origin}/invite/${token}`;
}

// Returns whether the email went out. The client row (and its invite token) is
// already saved by the time this runs, so a mail failure must not throw and
// undo a successful add — the therapist can hit "Resend invite" instead.
// On success the Resend id is stored so the bounce webhook can find this client,
// and any earlier bounce is cleared — it was about the previous email.
async function sendInvite(
	clientId: string,
	email: string,
	url: string,
	therapistName: string,
	therapistEmail: string
): Promise<boolean> {
	let emailId: string | null;
	try {
		emailId = await sendInviteEmail(email, url, therapistName, therapistEmail);
	} catch (err) {
		logError('clients.sendInvite', err);
		return false;
	}
	await db
		.update(client)
		.set({ inviteEmailId: emailId, inviteBouncedAt: null })
		.where(eq(client.id, clientId));
	return true;
}

async function sendInviteEmail(
	email: string,
	url: string,
	therapistName: string,
	therapistEmail: string
): Promise<string | null> {
	return sendEmail(
		email,
		"You've been invited",
		wrapEmail({
			heading: "You're invited",
			bodyHtml: `<p>${escapeHtml(therapistName)} has invited you to set up your client portal on Lumno.</p><p>Lumno is where you'll book and reschedule sessions, keep track of payments, and get notes and follow-ups your practitioner shares with you — all in one place.</p>`,
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

export async function getClient(therapistId: string, clientId: string) {
	const [row] = await db
		.select()
		.from(client)
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
	return row ?? null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Runs fn in a transaction that holds a row lock on the therapist, so concurrent
// cap checks for the same therapist take turns instead of all reading the same
// stale count. Other therapists are unaffected.
// The plan limit is read BEFORE the transaction opens: usageLimit uses the shared pool, so
// reading it while queued transactions hold every connection would deadlock.
async function withTherapistLock<T>(
	therapistId: string,
	fn: (tx: Tx, isAtLimit: () => Promise<boolean>) => Promise<T>
): Promise<T> {
	const limit = await usageLimit(therapistId, 'clients');
	return db.transaction(async (tx) => {
		await tx.execute(sql`select id from ${therapist} where ${therapist.id} = ${therapistId} for update`);

		// true when the therapist's plan has no room for another active client
		async function isAtLimit(): Promise<boolean> {
			const [{ count }] = await tx
				.select({ count: sql<number>`count(*)::int` })
				.from(client)
				.where(and(eq(client.therapistId, therapistId), isNull(client.deactivatedAt)));
			return limit !== null && count >= limit;
		}

		return fn(tx, isAtLimit);
	});
}

// allowInactive (bulk add only): once the plan's active-client cap is full, save the
// client deactivated instead of refusing — the same over-cap state a downgrade leaves
// (see syncClientActivationForCap). They still get the invite and portal, just can't
// book. Capped by the plan's inactiveClients so a free account can't mail hundreds.
export async function addClient(
	therapistId: string,
	input: NewClientInput,
	origin: string,
	options: { allowInactive?: boolean } = {}
) {
	const inviteToken = randomUUID();

	let inactiveLimit: number | null = null;
	if (options.allowInactive) {
		// read before the lock, same reason as usageLimit in withTherapistLock
		inactiveLimit = await usageLimit(therapistId, 'inactiveClients');
	}

	const result = await withTherapistLock(therapistId, async (tx, isAtLimit) => {
		let deactivatedAt: Date | null = null;
		if (await isAtLimit()) {
			if (!options.allowInactive || inactiveLimit === null) {
				return { error: 'limit_reached' as const };
			}
			// over-cap clients only — 'left' ones are deactivated for a different reason
			const [{ count }] = await tx
				.select({ count: sql<number>`count(*)::int` })
				.from(client)
				.where(
					and(
						eq(client.therapistId, therapistId),
						isNotNull(client.deactivatedAt),
						ne(client.status, 'left')
					)
				);
			if (count >= inactiveLimit) {
				return { error: 'inactive_limit_reached' as const };
			}
			deactivatedAt = new Date();
		}

		const [therapistUser] = await tx
			.select({ email: user.email, name: user.name })
			.from(therapist)
			.innerJoin(user, eq(therapist.userId, user.id))
			.where(eq(therapist.id, therapistId));
		if (therapistUser && therapistUser.email.toLowerCase() === input.email.toLowerCase()) {
			return { error: 'self' as const };
		}

		const [existing] = await tx
			.select()
			.from(client)
			.where(
				and(eq(client.therapistId, therapistId), eq(sql`lower(${client.email})`, input.email.toLowerCase()))
			);
		if (existing) {
			return { error: 'duplicate' as const };
		}

		const [row] = await tx
			.insert(client)
			.values({
				therapistId,
				...input,
				status: 'paused',
				inviteToken,
				inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
				deactivatedAt
			})
			.returning();
		return { row, therapistUser: therapistUser! };
	});

	if ('error' in result) {
		return { error: result.error };
	}

	// email goes out after commit so a slow send never holds the lock.
	// therapistUser is always found — therapist.userId is a required FK
	const inviteUrl = buildInviteUrl(origin, inviteToken);
	const emailSent = await sendInvite(
		result.row.id,
		input.email,
		inviteUrl,
		result.therapistUser.name,
		result.therapistUser.email
	);

	return { client: result.row, inviteUrl, emailSent };
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
	const emailSent = await sendInvite(
		clientRow.id,
		clientRow.email,
		inviteUrl,
		therapistUser!.name,
		therapistUser!.email
	);

	return { inviteUrl, emailSent };
}

// Called by the Resend webhook on a hard bounce. Matches on the latest invite's email
// id only, so a bounce for an older invite (already superseded by a resend) is ignored.
export async function markInviteBounced(emailId: string) {
	await db
		.update(client)
		.set({ inviteBouncedAt: new Date() })
		.where(eq(client.inviteEmailId, emailId));
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
	return withTherapistLock(therapistId, async (tx, isAtLimit) => {
		const [current] = await tx
			.select({ status: client.status })
			.from(client)
			.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
		if (!current) return { error: 'not_found' as const };

		if (current.status === 'left' && status !== 'left') {
			if (await isAtLimit()) {
				return { error: 'limit_reached' as const };
			}
		}

		await tx
			.update(client)
			.set({ status, ...deactivationChange(current.status, status) })
			.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
		return {};
	});
}

// Only moving into or out of 'left' touches deactivatedAt. Any other status change must
// leave it alone: an over-cap (deactivated) client switched paused -> active is still
// over the cap, and clearing it here would let a therapist unlock clients past their plan.
function deactivationChange(from: ClientStatus, to: ClientStatus): { deactivatedAt?: Date | null } {
	if (to === 'left') {
		if (from === 'left') {
			return {};
		}
		return { deactivatedAt: new Date() };
	}
	if (from === 'left') {
		// callers have already checked there's cap room
		return { deactivatedAt: null };
	}
	return {};
}

export type ClientUpdateInput = {
	name: string;
	customFields: ClientFieldValues;
	rate: number | null;
	status: ClientStatus;
};

export async function updateClient(therapistId: string, clientId: string, input: ClientUpdateInput) {
	return withTherapistLock(therapistId, async (tx, isAtLimit) => {
		const [current] = await tx
			.select({ status: client.status })
			.from(client)
			.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
		if (!current) return { error: 'not_found' as const };

		if (current.status === 'left' && input.status !== 'left') {
			if (await isAtLimit()) {
				return { error: 'limit_reached' as const };
			}
		}

		await tx
			.update(client)
			.set({
				name: input.name,
				customFields: input.customFields,
				rate: input.rate,
				status: input.status,
				...deactivationChange(current.status, input.status)
			})
			.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
		return {};
	});
}

export async function getInviteByToken(token: string) {
	const [row] = await db
		.select({ client, therapistName: user.name })
		.from(client)
		.innerJoin(therapist, eq(client.therapistId, therapist.id))
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(client.inviteToken, token));
	if (!row) return { error: 'not_found' as const };
	if (row.client.userId) return { error: 'already_joined' as const };
	if (!row.client.inviteExpiresAt || row.client.inviteExpiresAt < new Date()) {
		return { error: 'expired' as const };
	}
	return { client: row.client, therapistName: row.therapistName };
}

export async function linkClientToUser(clientId: string, userId: string) {
	await db
		.update(client)
		.set({ userId, status: 'active', inviteToken: null, inviteExpiresAt: null })
		.where(eq(client.id, clientId));
	// the invite link was emailed to this address, so ownership is already proven
	await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
}

// The phone is saved through savePhone in phoneVerification.ts: client.phone only ever
// holds a verified number.

// Callers must have already established that clientId belongs to the caller (invite
// token or locals.clientId). null clears back to "use the therapist's timezone" (see
// client.timezone comment).
export async function setClientTimezone(clientId: string, timezone: string | null) {
	await db.update(client).set({ timezone }).where(eq(client.id, clientId));
}

// Same trust model as setClientTimezone: the client's own answers, already validated by
// parseClientProfile. Callers must have established that clientId belongs to the caller.
export async function setClientProfile(clientId: string, profile: ClientProfile) {
	await db.update(client).set(profile).where(eq(client.id, clientId));
}

// A client's current custom-field values, so an edit can be merged on top of them.
export async function getClientCustomFields(therapistId: string, clientId: string) {
	const [row] = await db
		.select({ customFields: client.customFields })
		.from(client)
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
	if (!row) {
		return null;
	}
	return row.customFields;
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
