import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';

export type DisconnectGoogleResult = { ok: true } | { error: 'only_login' };

// Removes the Google account row (login + calendar access together). Refused when Google is
// the only way to sign in, otherwise the therapist would lock themselves out.
export async function disconnectGoogle(userId: string): Promise<DisconnectGoogleResult> {
	const otherLogins = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, userId), ne(account.providerId, 'google')));
	if (otherLogins.length === 0) {
		return { error: 'only_login' };
	}
	await db.delete(account).where(and(eq(account.userId, userId), eq(account.providerId, 'google')));
	return { ok: true };
}
