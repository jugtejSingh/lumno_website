import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { therapist, therapistSettings, paymentSettings } from '$lib/server/db/schema';

type ProfileFields = Partial<Omit<typeof therapist.$inferInsert, 'userId'>>;

// The one place a therapist row is born. Seeds the therapist_settings and
// payment_settings rows in the same transaction so every settings getter is a
// plain SELECT of a row that is guaranteed to exist — no "?? defaults"
// fallbacks, no innerJoin that silently hides a row-less therapist. The DB
// column defaults are the single source of truth for what those rows hold.
export async function createTherapistProfile(userId: string, fields: ProfileFields = {}) {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(therapist)
			.values({ userId, slug: randomUUID(), ...fields })
			.returning();
		await tx.insert(therapistSettings).values({ therapistId: row.id });
		await tx.insert(paymentSettings).values({ therapistId: row.id });
		return row;
	});
}