import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getEffectivePlan, usageLimit, syncClientActivationForCap } from '$lib/server/billing';
import { db } from '$lib/server/db';
import { client, subscription } from '$lib/server/db/schema';
import { resetDb, mkTherapist, mkSubscription, mkClient } from './helpers';

beforeEach(resetDb);

describe('getEffectivePlan', () => {
	it('is the free tier with no subscription row yet', async () => {
		const t = await mkTherapist();
		expect(await getEffectivePlan(t.id)).toEqual({ tier: 0, source: 'free' });
	});

	it('uses the therapist own active subscription', async () => {
		const t = await mkTherapist();
		await mkSubscription({ therapistId: t.id, plan: 2, status: 'active' });
		expect(await getEffectivePlan(t.id)).toEqual({ tier: 2, source: 'therapist' });
	});

	it('ignores a non-active subscription', async () => {
		const t = await mkTherapist();
		await mkSubscription({ therapistId: t.id, plan: 2, status: 'past_due' });
		expect(await getEffectivePlan(t.id)).toEqual({ tier: 0, source: 'free' });
	});
});

describe('usageLimit', () => {
	it('returns the tier cap for a known usage', async () => {
		const t = await mkTherapist();
		expect(await usageLimit(t.id, 'clients')).toBe(5);
	});

	it('returns null for an unknown usage key', async () => {
		const t = await mkTherapist();
		expect(await usageLimit(t.id, 'nonsense')).toBeNull();
	});
});

describe('syncClientActivationForCap', () => {
	it('deactivates the newest clients past the free cap, keeps the oldest bookable', async () => {
		const t = await mkTherapist();
		const clients = [];
		for (let i = 0; i < 7; i++) {
			clients.push(await mkClient(t.id, { name: `Client ${i}` }));
		}

		await syncClientActivationForCap(t.id);

		const rows = await db.select().from(client).where(eq(client.therapistId, t.id));
		const byId = new Map(rows.map((r) => [r.id, r]));
		for (let i = 0; i < 5; i++) {
			expect(byId.get(clients[i].id)?.deactivatedAt).toBeNull();
		}
		for (let i = 5; i < 7; i++) {
			expect(byId.get(clients[i].id)?.deactivatedAt).not.toBeNull();
		}
	});

	it('reactivates everyone once the therapist is back over the cap', async () => {
		const t = await mkTherapist();
		const clients = [];
		for (let i = 0; i < 7; i++) {
			clients.push(await mkClient(t.id, { name: `Client ${i}` }));
		}
		await syncClientActivationForCap(t.id);

		// syncClientActivationForCap's getEffectivePlan call already lazily
		// created the free-tier row above — update it, not another insert.
		await db
			.update(subscription)
			.set({ plan: 1, status: 'active' })
			.where(eq(subscription.therapistId, t.id));
		await syncClientActivationForCap(t.id);

		const rows = await db.select().from(client).where(eq(client.therapistId, t.id));
		expect(rows.every((r) => r.deactivatedAt === null)).toBe(true);
	});
});
