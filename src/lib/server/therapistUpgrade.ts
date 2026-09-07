import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { therapist, user, verification } from '$lib/server/db/schema';
import { createTherapistProfile } from '$lib/server/therapistProfile';

const UPGRADE_TTL_MS = 24 * 60 * 60 * 1000;
const IDENTIFIER_PREFIX = 'become-therapist:';

type PendingUpgrade = {
	userId: string;
	name: string;
};

function buildUpgradeUrl(origin: string, token: string) {
	return `${origin}/login/become-therapist/${token}`;
}

function logUpgradeEmail(email: string, url: string) {
	// ponytail: no email provider wired up yet — link just goes to the server log,
	// same as the auth verification and client invite emails.
	console.log(`[become-therapist] verification for ${email}: ${url}`);
}

// Called when signUpEmail's anti-enumeration path fires: the email already has
// an account, so better-auth returned a synthetic, unpersisted user instead of
// creating one. Rather than crash on that, offer to attach a bare therapist
// profile to the real existing account — gated by clicking the emailed link,
// so we don't silently repurpose someone else's account from a public form.
// Bio/photo/tags/etc. are filled in later via settings; name is the one field
// worth capturing now since they may have registered as a client with none.
export async function requestTherapistUpgrade(email: string, name: string, origin: string) {
	const [existingUser] = await db.select().from(user).where(eq(user.email, email));
	if (!existingUser) return;

	const [existingTherapist] = await db
		.select({ id: therapist.id })
		.from(therapist)
		.where(eq(therapist.userId, existingUser.id));
	if (existingTherapist) return;

	const token = randomUUID();
	const payload: PendingUpgrade = { userId: existingUser.id, name };
	await db.insert(verification).values({
		id: randomUUID(),
		identifier: IDENTIFIER_PREFIX + token,
		value: JSON.stringify(payload),
		expiresAt: new Date(Date.now() + UPGRADE_TTL_MS)
	});

	logUpgradeEmail(email, buildUpgradeUrl(origin, token));
}

export async function isValidUpgradeToken(token: string) {
	const [row] = await db
		.select({ expiresAt: verification.expiresAt })
		.from(verification)
		.where(eq(verification.identifier, IDENTIFIER_PREFIX + token));
	return Boolean(row) && row.expiresAt > new Date();
}

export async function completeTherapistUpgrade(token: string) {
	const [row] = await db
		.select()
		.from(verification)
		.where(eq(verification.identifier, IDENTIFIER_PREFIX + token));
	if (!row || row.expiresAt < new Date()) return { error: 'invalid' as const };

	await db.delete(verification).where(eq(verification.identifier, IDENTIFIER_PREFIX + token));

	const { userId, name } = JSON.parse(row.value) as PendingUpgrade;
	const [existingTherapist] = await db
		.select({ id: therapist.id })
		.from(therapist)
		.where(eq(therapist.userId, userId));
	if (existingTherapist) return { error: 'already_therapist' as const };

	if (name) {
		await db.update(user).set({ name }).where(eq(user.id, userId));
	}
	await createTherapistProfile(userId);

	return { success: true as const };
}
