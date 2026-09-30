import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { therapistSettings } from '$lib/server/db/schema';

const OUTREACH_LINK_DAYS = 7;

export type OutreachState = {
	token: string | null;
	expiresAt: Date | null;
};

// The therapist's current link, or nulls when the page is off or the link has lapsed.
export async function getOutreachState(therapistId: string): Promise<OutreachState> {
	const [row] = await db
		.select({
			token: therapistSettings.outreachToken,
			expiresAt: therapistSettings.outreachExpiresAt
		})
		.from(therapistSettings)
		.where(eq(therapistSettings.therapistId, therapistId));
	if (!row || !row.token || !row.expiresAt || row.expiresAt <= new Date()) {
		return { token: null, expiresAt: null };
	}
	return { token: row.token, expiresAt: row.expiresAt };
}

// Turning on and regenerating are the same operation: a fresh token replaces any old one,
// so the previous link dies immediately.
export async function generateOutreachLink(therapistId: string): Promise<OutreachState> {
	const token = randomBytes(24).toString('base64url');
	const expiresAt = new Date(Date.now() + OUTREACH_LINK_DAYS * 24 * 60 * 60 * 1000);
	await db
		.update(therapistSettings)
		.set({ outreachToken: token, outreachExpiresAt: expiresAt })
		.where(eq(therapistSettings.therapistId, therapistId));
	return { token, expiresAt };
}

export async function disableOutreach(therapistId: string): Promise<void> {
	await db
		.update(therapistSettings)
		.set({ outreachToken: null, outreachExpiresAt: null })
		.where(eq(therapistSettings.therapistId, therapistId));
}

// Public lookup: the therapist a live token belongs to. Off, unknown and expired tokens all
// return null, so callers can't tell them apart.
export async function findTherapistIdByOutreachToken(token: string): Promise<string | null> {
	if (!token) {
		return null;
	}
	const [row] = await db
		.select({ therapistId: therapistSettings.therapistId })
		.from(therapistSettings)
		.where(
			and(eq(therapistSettings.outreachToken, token), gt(therapistSettings.outreachExpiresAt, new Date()))
		);
	if (!row) {
		return null;
	}
	return row.therapistId;
}
