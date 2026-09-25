import { describe, it, expect, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { actions, load } from '../../src/routes/(app)/payments/+page.server';
import { getActivePackForClient, createPack, listPacksForTherapist } from '$lib/server/payments';
import { db } from '$lib/server/db';
import { payment } from '$lib/server/db/schema';
import { resetDb, mkTherapist, mkClient, mkPack, mkAppointment, mkEvent } from './helpers';

// The payments page's pack actions and the packs list its load returns. A pack's price
// and paid state live on its purchase payment row (payment.packId).

let therapist: Awaited<ReturnType<typeof mkTherapist>>;
let clientId: string;

function post(action: 'createPack' | 'markPaid', fields: Record<string, string>) {
	return actions[action](mkEvent({ locals: { therapistId: therapist.id }, fields }) as never);
}

function failure(result: unknown) {
	if (!isActionFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result)}`);
	}
	return { status: result.status, message: (result.data as unknown as { message: string }).message };
}

async function loadPage() {
	const event = mkEvent({ parent: async () => ({ therapist }) });
	return (await load(event as never)) as unknown as {
		packs: { id: string; clientName: string; sessionCount: number; remaining: number }[];
		balances: { clientId: string | null; owed: number }[];
	};
}

async function purchaseRow(packId: string) {
	const rows = await db.select().from(payment).where(eq(payment.packId, packId));
	expect(rows).toHaveLength(1);
	return rows[0];
}

beforeEach(async () => {
	await resetDb();
	therapist = await mkTherapist();
	clientId = (await mkClient(therapist.id)).id;
});

describe('createPack action', () => {
	it('creates an immediately usable pack with an unpaid purchase row for its price', async () => {
		const result = await post('createPack', { clientId, sessionCount: '5', amount: '4500' });
		expect(isActionFailure(result)).toBe(false);

		const pack = await getActivePackForClient(clientId);
		expect(pack).toMatchObject({ sessionCount: 5, remaining: 5 });
		expect(await purchaseRow(pack!.id)).toMatchObject({ amount: 4500, status: 'unpaid', paidAt: null });
	});

	it('marks the purchase row paid when the checkbox is on', async () => {
		await post('createPack', { clientId, sessionCount: '5', amount: '4500', paid: 'on' });

		const pack = await getActivePackForClient(clientId);
		const row = await purchaseRow(pack!.id);
		expect(row.status).toBe('paid');
		expect(row.paidAt).not.toBeNull();
	});

	it('rejects a missing client', async () => {
		expect(failure(await post('createPack', { sessionCount: '5', amount: '4500' }))).toEqual({
			status: 400,
			message: 'Pick a client'
		});
	});

	it('rejects bad session counts and prices, creating no pack and no charge', async () => {
		const badSessions = ['', '0', '-2', 'abc'];
		for (const sessionCount of badSessions) {
			expect(failure(await post('createPack', { clientId, sessionCount, amount: '4500' }))).toEqual({
				status: 400,
				message: 'Enter a whole number of sessions greater than 0'
			});
		}
		const badPrices = ['', '0', '-5', 'abc'];
		for (const amount of badPrices) {
			expect(failure(await post('createPack', { clientId, sessionCount: '5', amount }))).toEqual({
				status: 400,
				message: 'Enter a whole number price greater than 0'
			});
		}
		expect(await listPacksForTherapist(therapist.id)).toEqual([]);
		expect(await db.select().from(payment)).toEqual([]);
	});

	it('refuses a second pack while sessions remain and says how many', async () => {
		await createPack(therapist.id, { clientId, sessionCount: 3, amount: 3000, paid: true });

		expect(failure(await post('createPack', { clientId, sessionCount: '5', amount: '4500' }))).toEqual({
			status: 400,
			message: 'This client still has 3 session(s) left on their current pack'
		});
		expect(await listPacksForTherapist(therapist.id)).toHaveLength(1);
		expect(await db.select().from(payment)).toHaveLength(1);
	});

	it('404s for a client that is not the therapist’s', async () => {
		const other = await mkTherapist();
		const otherClient = await mkClient(other.id);

		expect(
			failure(await post('createPack', { clientId: otherClient.id, sessionCount: '5', amount: '4500' }))
		).toEqual({ status: 404, message: 'That client could not be found' });
	});
});

describe('paying for a pack', () => {
	it('markPaid on the purchase row pays for the pack and clears what the client owes', async () => {
		const { pack } = await createPack(therapist.id, { clientId, sessionCount: 3, amount: 3000, paid: false });
		const row = await purchaseRow(pack!.id);
		expect((await loadPage()).balances).toMatchObject([{ clientId, owed: 3000 }]);

		const result = await post('markPaid', { paymentId: row.id });
		expect(isActionFailure(result)).toBe(false);
		expect((await purchaseRow(pack!.id)).status).toBe('paid');
		expect((await loadPage()).balances).toEqual([]);
	});

	it('markPaid 404s for another therapist’s pack and leaves it unpaid', async () => {
		const other = await mkTherapist();
		const otherClient = await mkClient(other.id);
		const otherPack = await mkPack(other.id, otherClient.id, { status: 'active' }, { amount: 2000, paid: false });
		const row = await purchaseRow(otherPack.id);

		expect(failure(await post('markPaid', { paymentId: row.id })).status).toBe(404);
		expect((await purchaseRow(otherPack.id)).status).toBe('unpaid');
	});
});

describe('load packs list', () => {
	it('lists an active pack with its remaining sessions', async () => {
		const { pack } = await createPack(therapist.id, { clientId, sessionCount: 3, amount: 3000, paid: false });
		await mkAppointment(therapist.id, clientId, { packId: pack!.id });

		const { packs } = await loadPage();
		expect(packs).toEqual([{ id: pack!.id, clientName: 'Test Client', sessionCount: 3, remaining: 2 }]);
	});

	it('hides a finished pack that was paid for', async () => {
		await mkPack(therapist.id, clientId, { status: 'completed' }, { amount: 9000, paid: true });
		expect((await loadPage()).packs).toEqual([]);
	});

	it('hides a finished unpaid pack from the list, but its price is still owed', async () => {
		await mkPack(therapist.id, clientId, { status: 'completed' }, { amount: 9000, paid: false });

		const page = await loadPage();
		expect(page.packs).toEqual([]);
		expect(page.balances).toMatchObject([{ clientId, owed: 9000 }]);
	});

	it('hides cancelled packs', async () => {
		await mkPack(therapist.id, clientId, { status: 'cancelled' });
		expect((await loadPage()).packs).toEqual([]);
	});
});
