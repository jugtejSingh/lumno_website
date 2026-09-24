import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
	getEffectivePlan,
	usageLimit,
	syncClientActivationForCap,
	claimPendingSlot,
	CREATING_SENTINEL,
	handleWebhookEvent,
	type WebhookEventInput
} from '$lib/server/billing';
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

describe('claimPendingSlot', () => {
	it('does not reclaim an old-but-real pending sub id just because it is past the stale window', async () => {
		const t = await mkTherapist();
		await mkSubscription({
			therapistId: t.id,
			pendingSubId: 'sub_realone',
			pendingSince: new Date(Date.now() - 120_000)
		});
		expect(await claimPendingSlot(t.id, 'sub_someoneelse')).toBe(false);
	});

	it('reclaims a slot still stuck on the creating sentinel past the stale window', async () => {
		const t = await mkTherapist();
		await mkSubscription({
			therapistId: t.id,
			pendingSubId: CREATING_SENTINEL,
			pendingSince: new Date(Date.now() - 120_000)
		});
		expect(await claimPendingSlot(t.id, 'sub_someoneelse')).toBe(true);
	});
});

describe('handleWebhookEvent', () => {
	it('keeps the therapist tier on cancellation instead of resetting it to free', async () => {
		const t = await mkTherapist();
		await mkSubscription({
			therapistId: t.id,
			plan: 2,
			status: 'active',
			razorpaySubscriptionId: 'sub_cancel_me'
		});
		const input: WebhookEventInput = {
			signature: randomUUID(),
			therapistId: t.id,
			plan: 2,
			status: 'cancelled',
			razorpaySubscriptionId: 'sub_cancel_me',
			razorpayCustomerId: null,
			currentEnd: new Date('2030-01-01'),
			event: 'subscription.cancelled',
			razorpayPlanId: null,
			razorpayPaymentId: null,
			amount: null,
			currency: null
		};
		const { processed } = await handleWebhookEvent(input);
		expect(processed).toBe(true);

		const [row] = await db.select().from(subscription).where(eq(subscription.therapistId, t.id));
		expect(row.plan).toBe(2);
		expect(row.status).toBe('cancelled');
		// getEffectivePlan still gates purely on status, so retaining plan is safe
		expect(await getEffectivePlan(t.id)).toEqual({ tier: 0, source: 'free' });
	});
});

describe('usageLimit', () => {
	it('returns the tier cap for a known usage', async () => {
		const t = await mkTherapist();
		expect(await usageLimit(t.id, 'clients')).toBe(10);
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
		for (let i = 0; i < 12; i++) {
			clients.push(await mkClient(t.id, { name: `Client ${i}` }));
		}

		await syncClientActivationForCap(t.id);

		const rows = await db.select().from(client).where(eq(client.therapistId, t.id));
		const byId = new Map(rows.map((r) => [r.id, r]));
		for (let i = 0; i < 10; i++) {
			expect(byId.get(clients[i].id)?.deactivatedAt).toBeNull();
		}
		for (let i = 10; i < 12; i++) {
			expect(byId.get(clients[i].id)?.deactivatedAt).not.toBeNull();
		}
	});

	it('reactivates everyone once the therapist is back over the cap', async () => {
		const t = await mkTherapist();
		const clients = [];
		for (let i = 0; i < 12; i++) {
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
