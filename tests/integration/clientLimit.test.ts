import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	addClient,
	setClientStatus,
	updateClient,
	listClients,
	type NewClientInput
} from '$lib/server/clients';
import { resetDb, mkTherapist } from './helpers';

// Spec under test (written from the product rule, not from the implementation):
//   a free-plan therapist can never have more than FREE_LIMIT active clients at any moment.
// "Active" = not deactivated (status 'left' deactivates). Every test only drives the public
// server functions and re-checks the invariant from the DB afterwards.
const FREE_LIMIT = 10;
const ATTEMPTS = 25;

let therapistId: string;

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	therapistId = (await mkTherapist()).id;
});

function input(n: number): NewClientInput {
	return {
		name: `Client ${n}`,
		email: `client-${n}@example.com`,
		customFields: {},
		tags: [],
		rate: 1000
	};
}

async function activeClients() {
	const rows = await listClients(therapistId);
	const active = [];
	for (const row of rows) {
		if (row.deactivatedAt === null) {
			active.push(row);
		}
	}
	return active;
}

// Adds `count` clients one at a time and tallies the outcome of each attempt. Anything that is
// neither a success nor limit_reached (self, duplicate, ...) is counted as `other`, so a client
// rejected for the wrong reason can't hide behind a correct-looking active count.
async function addMany(count: number, startAt = 0) {
	const tally = { succeeded: 0, limitReached: 0, other: 0 };
	for (let i = 0; i < count; i++) {
		const res = await addClient(therapistId, input(startAt + i), 'https://app.test');
		if ('client' in res) {
			tally.succeeded++;
		} else if (res.error === 'limit_reached') {
			tally.limitReached++;
		} else {
			tally.other++;
		}
	}
	return tally;
}

describe('free plan client cap', () => {
	it('never lets active clients exceed the cap when adding one by one', async () => {
		const tally = await addMany(ATTEMPTS);

		const active = await activeClients();
		expect(active.length).toBeLessThanOrEqual(FREE_LIMIT);
		// the cap is also reachable: a free therapist must be able to have exactly FREE_LIMIT
		expect(active.length).toBe(FREE_LIMIT);
		expect(tally).toEqual({
			succeeded: FREE_LIMIT,
			limitReached: ATTEMPTS - FREE_LIMIT,
			other: 0
		});
	});

	it('add 15 (10 in, 5 rejected), 2 leave, add 4 (2 in, 2 rejected), ends at exactly 10', async () => {
		const first = await addMany(15);
		expect(first).toEqual({ succeeded: 10, limitReached: 5, other: 0 });

		const active = await activeClients();
		await setClientStatus(therapistId, active[0].id, 'left');
		await setClientStatus(therapistId, active[1].id, 'left');
		expect((await activeClients()).length).toBe(8);

		const second = await addMany(4, 100);
		expect(second).toEqual({ succeeded: 2, limitReached: 2, other: 0 });
		expect((await activeClients()).length).toBe(10);
	});

	it('never exceeds the cap when many adds are fired at the same time', async () => {
		const attempts = [];
		for (let i = 0; i < ATTEMPTS; i++) {
			attempts.push(addClient(therapistId, input(i), 'https://app.test'));
		}
		await Promise.all(attempts);

		const active = await activeClients();
		expect(active.length).toBeLessThanOrEqual(FREE_LIMIT);
	});

	it('frees room when a client leaves, but still never exceeds the cap', async () => {
		await addMany(FREE_LIMIT);
		const full = await activeClients();
		expect(full.length).toBe(FREE_LIMIT);

		// three leave -> three slots open
		for (let i = 0; i < 3; i++) {
			await setClientStatus(therapistId, full[i].id, 'left');
		}
		expect((await activeClients()).length).toBe(FREE_LIMIT - 3);

		// try to add far more than the room available
		await addMany(ATTEMPTS, 100);
		expect((await activeClients()).length).toBe(FREE_LIMIT);
	});

	it('cannot bring left clients back past the cap via setClientStatus', async () => {
		await addMany(FREE_LIMIT);
		const full = await activeClients();
		for (const c of full) {
			await setClientStatus(therapistId, c.id, 'left');
		}
		expect((await activeClients()).length).toBe(0);

		// fill the cap with fresh clients, then try to reactivate everyone who left
		await addMany(FREE_LIMIT, 100);
		expect((await activeClients()).length).toBe(FREE_LIMIT);

		for (const c of full) {
			await setClientStatus(therapistId, c.id, 'active');
		}
		expect((await activeClients()).length).toBeLessThanOrEqual(FREE_LIMIT);
	});

	it('cannot bring left clients back past the cap via updateClient', async () => {
		await addMany(FREE_LIMIT);
		const full = await activeClients();
		for (const c of full) {
			await setClientStatus(therapistId, c.id, 'left');
		}

		await addMany(FREE_LIMIT, 100);
		expect((await activeClients()).length).toBe(FREE_LIMIT);

		for (const c of full) {
			await updateClient(therapistId, c.id, {
				name: c.name,
				customFields: {},
				tags: [],
				rate: c.rate,
				status: 'active'
			});
		}
		expect((await activeClients()).length).toBeLessThanOrEqual(FREE_LIMIT);
	});

	it('never exceeds the cap when many left clients are reactivated at the same time', async () => {
		await addMany(FREE_LIMIT);
		const full = await activeClients();
		for (const c of full) {
			await setClientStatus(therapistId, c.id, 'left');
		}
		// 5 active, 10 left: 10 simultaneous comebacks must only fit 5
		await addMany(5, 100);

		const comebacks = [];
		for (const c of full) {
			comebacks.push(setClientStatus(therapistId, c.id, 'active'));
		}
		await Promise.all(comebacks);

		expect((await activeClients()).length).toBeLessThanOrEqual(FREE_LIMIT);
	});

	it('does not let a paused client be used to slip extra clients past the cap', async () => {
		await addMany(FREE_LIMIT);
		const full = await activeClients();
		for (const c of full) {
			await setClientStatus(therapistId, c.id, 'paused');
		}

		await addMany(ATTEMPTS, 100);
		expect((await activeClients()).length).toBeLessThanOrEqual(FREE_LIMIT);
	});

	it('counts each therapist separately', async () => {
		const otherId = (await mkTherapist()).id;
		await addMany(FREE_LIMIT);

		const res = await addClient(otherId, input(500), 'https://app.test');
		expect(res).toHaveProperty('client');
	});
});
