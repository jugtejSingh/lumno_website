import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organization, therapist } from '$lib/server/db/schema';
import { getEffectivePlan } from '$lib/server/billing';

// Create a practice owned by the given therapist and make them its first member.
// The caller is already known to be a therapist (the (app) layout guard). Checks:
// not already in an org (one org per therapist), and no personal subscription —
// org members bill through the org, so a personal plan has to be cancelled first.
export async function createOrganization(ownerTherapistId: string, name: string) {
	const [owner] = await db
		.select({ organizationId: therapist.organizationId })
		.from(therapist)
		.where(eq(therapist.id, ownerTherapistId));

	if (!owner) {
		return { error: 'not_therapist' as const };
	}
	if (owner.organizationId) {
		return { error: 'already_in_org' as const };
	}

	const plan = await getEffectivePlan(ownerTherapistId);
	if (plan.source === 'therapist') {
		return { error: 'has_subscription' as const };
	}

	const org = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(organization)
			.values({ name, ownerTherapistId })
			.returning();
		await tx
			.update(therapist)
			.set({ organizationId: created.id })
			.where(eq(therapist.id, ownerTherapistId));
		return created;
	});

	return { organization: org };
}
