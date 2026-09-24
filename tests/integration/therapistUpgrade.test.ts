import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';

const { completeTherapistUpgrade } = await import('$lib/server/therapistUpgrade');
const { db } = await import('$lib/server/db');
const { verification } = await import('$lib/server/db/schema');
const { resetDb, mkUser } = await import('./helpers');

beforeEach(async () => {
	await resetDb();
});

async function mkUpgradeToken(userId: string) {
	const token = randomUUID();
	await db.insert(verification).values({
		id: randomUUID(),
		identifier: `become-therapist:${token}`,
		value: JSON.stringify({ userId, name: '' }),
		expiresAt: new Date(Date.now() + 60_000)
	});
	return token;
}

describe('completeTherapistUpgrade', () => {
	it('returns already_therapist (not a thrown error) when two completions race', async () => {
		const u = await mkUser();
		// Two separate tokens for the same user so each call has its own
		// verification row to delete — isolates the race to the
		// existingTherapist-check vs. createTherapistProfile-insert gap.
		const tokenA = await mkUpgradeToken(u.id);
		const tokenB = await mkUpgradeToken(u.id);

		// Both calls pass the existingTherapist check before either's insert
		// commits — the loser must hit the unique-violation catch, not throw.
		const results = await Promise.all([
			completeTherapistUpgrade(tokenA),
			completeTherapistUpgrade(tokenB)
		]);

		const errors = results.map((r) => ('error' in r ? r.error : null));
		const successes = results.filter((r) => 'success' in r);
		expect(successes).toHaveLength(1);
		expect(errors).toContain('already_therapist');
	});

	it('succeeds on a normal single completion', async () => {
		const u = await mkUser();
		const token = await mkUpgradeToken(u.id);
		const result = await completeTherapistUpgrade(token);
		expect(result).toEqual({ success: true });
	});
});
