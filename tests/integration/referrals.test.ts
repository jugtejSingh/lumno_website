import { describe, it, expect, beforeEach } from 'vitest';

const { listReferralTherapists } = await import('$lib/server/referrals');
const { db } = await import('$lib/server/db');
const { therapistSettings, user } = await import('$lib/server/db/schema');
const { eq } = await import('drizzle-orm');
const { resetDb, mkTherapist } = await import('./helpers');

beforeEach(async () => {
	await resetDb();
});

async function mkVisibleTherapist(name: string) {
	const t = await mkTherapist();
	await db
		.update(therapistSettings)
		.set({ referralVisible: true })
		.where(eq(therapistSettings.therapistId, t.id));
	await db.update(user).set({ name }).where(eq(user.id, t.user.id));
	return t;
}

describe('listReferralTherapists search', () => {
	it('does not treat % or _ in the query as wildcards', async () => {
		const viewer = await mkVisibleTherapist('Viewer');
		await mkVisibleTherapist('Alice Anderson');
		await mkVisibleTherapist('Bob 50%');

		const literalPercent = await listReferralTherapists(viewer.id, { q: '50%' });
		expect(literalPercent.therapists.map((t) => t.name)).toEqual(['Bob 50%']);

		const anyName = await listReferralTherapists(viewer.id, { q: '_' });
		expect(anyName.therapists).toHaveLength(0);
	});
});
