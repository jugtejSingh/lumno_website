import { it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { therapist } from '$lib/server/db/schema';
import { createOrganization } from '$lib/server/organizations';
import { resetDb, mkTherapist, mkSubscription } from './helpers';

beforeEach(resetDb);

it('creates the org and makes the owner its first member', async () => {
	const owner = await mkTherapist();
	const res = await createOrganization(owner.id, 'Reyes Therapy');
	expect(res).toMatchObject({ organization: { name: 'Reyes Therapy' } });

	const [row] = await db.select().from(therapist).where(eq(therapist.id, owner.id));
	expect(row.organizationId).toBe(res.organization!.id);
});

it('refuses a therapist already in an org', async () => {
	const owner = await mkTherapist();
	await createOrganization(owner.id, 'First');
	expect(await createOrganization(owner.id, 'Second')).toEqual({ error: 'already_in_org' });
});

it('refuses a therapist on a personal subscription', async () => {
	const owner = await mkTherapist();
	await mkSubscription({ therapistId: owner.id, plan: 1, status: 'active' });
	expect(await createOrganization(owner.id, 'Nope')).toEqual({ error: 'has_subscription' });
});
