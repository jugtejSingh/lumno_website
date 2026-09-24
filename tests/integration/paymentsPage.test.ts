import { describe, it, expect, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { actions, load } from '../../src/routes/(app)/payments/+page.server';
import { getActivePackForClient, createPack, listPacksForTherapist } from '$lib/server/payments';
import { resetDb, mkTherapist, mkClient, mkPack, mkAppointment, mkEvent } from './helpers';

// The payments page's pack actions and the packs list its load returns.

let therapist: Awaited<ReturnType<typeof mkTherapist>>;
let clientId: string;

function post(action: 'createPack' | 'markPackPaid', fields: Record<string, string>) {
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
		packs: { id: string; clientName: string; sessionCount: number; remaining: number; amount: number; paid: boolean }[];
	};
}

beforeEach(async () => {
	await resetDb();
	therapist = await mkTherapist();
	clientId = (await mkClient(therapist.id)).id;
});

describe('createPack action', () => {
	it('creates an unpaid, immediately usable pack', async () => {
		const result = await post('createPack', { clientId, sessionCount: '5', amount: '4500' });
		expect(isActionFailure(result)).toBe(false);

		const pack = await getActivePackForClient(clientId);
		expect(pack).toMatchObject({ sessionCount: 5, amount: 4500, remaining: 5 });
		expect(pack!.paidAt).toBeNull();
	});

	it('marks the pack paid when the checkbox is on', async () => {
		await post('createPack', { clientId, sessionCount: '5', amount: '4500', paid: 'on' });
		expect((await getActivePackForClient(clientId))!.paidAt).not.toBeNull();
	});

	it('rejects a missing client', async () => {
		expect(failure(await post('createPack', { sessionCount: '5', amount: '4500' }))).toEqual({
			status: 400,
			message: 'Pick a client'
		});
	});

	it('rejects bad session counts and prices', async () => {
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
	});

	it('refuses a second pack while sessions remain and says how many', async () => {
		await createPack(therapist.id, { clientId, sessionCount: 3, amount: 3000, paid: true });

		expect(failure(await post('createPack', { clientId, sessionCount: '5', amount: '4500' }))).toEqual({
			status: 400,
			message: 'This client still has 3 session(s) left on their current pack'
		});
		expect(await listPacksForTherapist(therapist.id)).toHaveLength(1);
	});

	it('404s for a client that is not the therapist’s', async () => {
		const other = await mkTherapist();
		const otherClient = await mkClient(other.id);

		expect(
			failure(await post('createPack', { clientId: otherClient.id, sessionCount: '5', amount: '4500' }))
		).toEqual({ status: 404, message: 'That client could not be found' });
	});
});

describe('markPackPaid action', () => {
	it('marks an unpaid pack paid', async () => {
		const { pack } = await createPack(therapist.id, { clientId, sessionCount: 3, amount: 3000, paid: false });

		const result = await post('markPackPaid', { packId: pack!.id });
		expect(isActionFailure(result)).toBe(false);
		expect((await getActivePackForClient(clientId))!.paidAt).not.toBeNull();
	});

	it('404s for an unknown pack', async () => {
		expect(failure(await post('markPackPaid', { packId: 'nope' }))).toEqual({
			status: 404,
			message: 'That pack could not be found. Refresh and try again.'
		});
	});

	it('404s for another therapist’s pack and leaves it unpaid', async () => {
		const other = await mkTherapist();
		const otherClient = await mkClient(other.id);
		const otherPack = await mkPack(other.id, otherClient.id, { status: 'active' });

		expect(failure(await post('markPackPaid', { packId: otherPack.id })).status).toBe(404);
		expect(await listPacksForTherapist(other.id)).toMatchObject([{ paidAt: null }]);
	});
});

describe('load packs list', () => {
	it('lists an active pack with its remaining sessions and paid flag', async () => {
		const { pack } = await createPack(therapist.id, { clientId, sessionCount: 3, amount: 3000, paid: false });
		await mkAppointment(therapist.id, clientId, { packId: pack!.id });

		const { packs } = await loadPage();
		expect(packs).toEqual([
			{ id: pack!.id, clientName: 'Test Client', sessionCount: 3, remaining: 2, amount: 3000, paid: false }
		]);
	});

	it('hides a finished pack that was paid for', async () => {
		await mkPack(therapist.id, clientId, { status: 'completed', paidAt: new Date() });
		expect((await loadPage()).packs).toEqual([]);
	});

	it('keeps a finished pack that is still unpaid', async () => {
		await mkPack(therapist.id, clientId, { status: 'completed', paidAt: null });
		expect((await loadPage()).packs).toHaveLength(1);
	});

	it('hides cancelled packs', async () => {
		await mkPack(therapist.id, clientId, { status: 'cancelled', paidAt: null });
		expect((await loadPage()).packs).toEqual([]);
	});
});
