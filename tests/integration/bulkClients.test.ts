import { describe, it, expect, beforeEach, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';

// The AI step and the per-hour limiter are stubbed; the plan gates, the monthly import
// count, and the save loop (cap -> inactive -> inactive limit) run against the real DB.
const extractClients = vi.fn();
const bulkLimit = vi.fn(async () => ({ success: true }));
vi.mock('$lib/server/ai', async (importOriginal) => {
	const original = await importOriginal<typeof import('$lib/server/ai')>();
	return { ...original, extractClients };
});
vi.mock('$lib/server/rateLimit', () => ({ bulkExtractRatelimit: { limit: bulkLimit } }));

const { db } = await import('$lib/server/db');
const { aiUsage, client } = await import('$lib/server/db/schema');
const { bulkAddClients, extractBulkClients } = await import('$lib/server/bulkClients');
const { addClient, setClientStatus, updateClient, listClients } = await import('$lib/server/clients');
const { resetDb, mkTherapist, mkSubscription } = await import('./helpers');

const ORIGIN = 'http://localhost';
let therapistId: string;

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	therapistId = (await mkTherapist()).id;
});

function people(count: number, startAt = 0) {
	const rows = [];
	for (let i = startAt; i < startAt + count; i++) {
		rows.push({ name: `Client ${i}`, email: `client-${i}@example.com`, rate: 0 });
	}
	return rows;
}

async function counts() {
	let active = 0;
	let inactive = 0;
	for (const row of await listClients(therapistId)) {
		if (row.deactivatedAt === null) {
			active += 1;
		} else {
			inactive += 1;
		}
	}
	return { active, inactive };
}

describe('bulkAddClients on the free plan', () => {
	it('adds the first 10 active and the rest inactive, all invited', async () => {
		const results = await bulkAddClients(therapistId, people(40), ORIGIN);

		let added = 0;
		let addedInactive = 0;
		for (const row of results) {
			if (row.outcome === 'added') {
				added += 1;
			} else if (row.outcome === 'added_inactive') {
				addedInactive += 1;
			}
		}
		expect(added).toBe(10);
		expect(addedInactive).toBe(30);
		expect(await counts()).toEqual({ active: 10, inactive: 30 });
	});

	it('stops at 50 inactive and reports the rest as not added', async () => {
		const results = await bulkAddClients(therapistId, people(70), ORIGIN);

		let notAdded = 0;
		for (const row of results) {
			if (row.outcome === 'not_added_limit') {
				notAdded += 1;
			}
		}
		expect(notAdded).toBe(10);
		expect(await counts()).toEqual({ active: 10, inactive: 50 });
	});

	it('skips flagged rows and existing clients without saving them', async () => {
		await bulkAddClients(therapistId, people(1), ORIGIN);
		const results = await bulkAddClients(
			therapistId,
			[
				{ name: 'Client 0', email: 'CLIENT-0@example.com', rate: 0 },
				{ name: 'Nolastname', email: 'x@example.com', rate: 0 },
				{ name: 'Bad Email', email: 'nope', rate: 0 }
			],
			ORIGIN
		);
		expect(results.map((row) => row.outcome)).toEqual([
			'skipped_duplicate',
			'skipped_invalid',
			'skipped_invalid'
		]);
		expect((await listClients(therapistId)).length).toBe(1);
	});

	it("saves each row's price on the client", async () => {
		await bulkAddClients(
			therapistId,
			[
				{ name: 'Jane Doe', email: 'jane@example.com', rate: 60 },
				{ name: 'Sam Lee', email: 'sam@example.com', rate: 0 }
			],
			ORIGIN
		);
		const rates: Record<string, number | null> = {};
		for (const row of await listClients(therapistId)) {
			rates[row.email ?? ''] = row.rate;
		}
		expect(rates).toEqual({ 'jane@example.com': 60, 'sam@example.com': 0 });
	});

	it('leaves the single add refusing at the cap', async () => {
		await bulkAddClients(therapistId, people(10), ORIGIN);
		const result = await addClient(
			therapistId,
			{ name: 'One More', email: 'one-more@example.com', customFields: {}, rate: null },
			ORIGIN
		);
		expect(result).toEqual({ error: 'limit_reached' });
	});
});

describe('status changes keep over-cap clients inactive', () => {
	it('paused -> active does not reactivate an over-cap client', async () => {
		await bulkAddClients(therapistId, people(11), ORIGIN);
		const [overCap] = await db
			.select()
			.from(client)
			.where(and(eq(client.therapistId, therapistId), eq(client.email, 'client-10@example.com')));
		expect(overCap.deactivatedAt).not.toBeNull();

		await setClientStatus(therapistId, overCap.id, 'active');
		await updateClient(therapistId, overCap.id, {
			name: overCap.name,
			rate: null,
			status: 'active',
			customFields: {}
		});

		expect(await counts()).toEqual({ active: 10, inactive: 1 });
	});
});

describe('extractBulkClients', () => {
	it('lets a free account run 3 imports a month, then refuses', async () => {
		extractClients.mockResolvedValue([{ name: 'Jane Doe', email: 'jane@example.com' }]);

		for (let i = 0; i < 3; i++) {
			const result = await extractBulkClients(therapistId, 'Jane Doe jane@example.com');
			expect('rows' in result).toBe(true);
		}
		const fourth = await extractBulkClients(therapistId, 'Jane Doe jane@example.com');
		expect(fourth).toMatchObject({ status: 429 });
		expect(extractClients).toHaveBeenCalledTimes(3);

		const [usage] = await db.select().from(aiUsage).where(eq(aiUsage.therapistId, therapistId));
		expect(usage.bulkImports).toBe(3);
	});

	it('does not use up an import when the AI fails', async () => {
		extractClients.mockResolvedValue(null);
		const result = await extractBulkClients(therapistId, 'anything');
		expect(result).toMatchObject({ status: 502 });
		const rows = await db.select().from(aiUsage).where(eq(aiUsage.therapistId, therapistId));
		expect(rows).toHaveLength(0);
	});

	it('lets a paid account run 100 imports a month, then refuses', async () => {
		await mkSubscription({ therapistId, plan: 1, status: 'active' });
		extractClients.mockResolvedValue([]);
		await db.insert(aiUsage).values({
			therapistId,
			yearMonth: new Date().toISOString().slice(0, 7),
			bulkImports: 99
		});

		const hundredth = await extractBulkClients(therapistId, 'text');
		expect('rows' in hundredth).toBe(true);
		const overLimit = await extractBulkClients(therapistId, 'text');
		expect(overLimit).toMatchObject({ status: 429 });
		expect(extractClients).toHaveBeenCalledTimes(1);
	});

	it('refuses empty and oversized text before calling the AI', async () => {
		expect(await extractBulkClients(therapistId, '   ')).toMatchObject({ status: 400 });
		expect(await extractBulkClients(therapistId, 'x'.repeat(20_001))).toMatchObject({ status: 400 });
		expect(extractClients).not.toHaveBeenCalled();
	});
});
