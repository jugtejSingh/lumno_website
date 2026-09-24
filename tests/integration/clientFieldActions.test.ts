import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { isActionFailure } from '@sveltejs/kit';

// settings imports better-auth and object storage; neither is exercised by the save
// paths tested here (no QR upload), so stub them out
vi.mock('$lib/server/auth', () => ({ auth: { api: {} } }));
vi.mock('$lib/server/storage', () => ({
	putObject: vi.fn(),
	deleteObject: vi.fn(),
	signedUrl: vi.fn(async () => null)
}));

const { db } = await import('$lib/server/db');
const { client } = await import('$lib/server/db/schema');
const { getClientFieldHeadings, updateClientFieldHeadings } = await import('$lib/server/clientFields');
const { clientFieldInputName } = await import('$lib/types/clientFields');
const { actions: clientActions } = await import('../../src/routes/(app)/clients/[clientId]/+page.server');
const { actions: settingsActions } = await import('../../src/routes/(app)/settings/+page.server');
const { resetDb, mkTherapist, mkClient, mkEvent } = await import('./helpers');

// Therapist-defined client field headings: saved from settings, filled in per client.

const GOALS = '11111111-1111-4111-8111-111111111111';
const HISTORY = '22222222-2222-4222-8222-222222222222';
const DELETED = '33333333-3333-4333-8333-333333333333';

let therapistId: string;

function updateClient(fields: Record<string, string>, asTherapistId = therapistId) {
	return clientActions.update(
		mkEvent({ locals: { therapistId: asTherapistId }, params: { clientId: fields.clientId }, fields }) as never
	);
}

function saveSettings(fields: Record<string, string | string[]>) {
	return settingsActions.save(
		mkEvent({ locals: { therapistId }, fields: { name: 'Dr Test', freeChangeWindowHours: '24', timezone: 'Europe/London', ...fields } }) as never
	);
}

async function customFieldsOf(id: string) {
	const [row] = await db.select({ customFields: client.customFields }).from(client).where(eq(client.id, id));
	return row.customFields;
}

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist()).id;
});

describe('clients update action — custom fields', () => {
	let clientId: string;

	beforeEach(async () => {
		await updateClientFieldHeadings(therapistId, [
			{ id: GOALS, label: 'Goals' },
			{ id: HISTORY, label: 'History' }
		]);
		clientId = (
			await mkClient(therapistId, {
				name: 'Sam Client',
				customFields: { [GOALS]: 'old goals', [HISTORY]: 'old history', [DELETED]: 'kept from a deleted heading' }
			})
		).id;
	});

	function baseFields(extra: Record<string, string> = {}) {
		return { clientId, name: 'Sam Client', status: 'active', ...extra };
	}

	it('updates values for current headings and keeps values under deleted headings', async () => {
		const result = await updateClient(
			baseFields({ [clientFieldInputName(GOALS)]: '  new goals  ', [clientFieldInputName(HISTORY)]: 'new history' })
		);
		expect(isActionFailure(result)).toBe(false);
		expect(await customFieldsOf(clientId)).toEqual({
			[GOALS]: 'new goals',
			[HISTORY]: 'new history',
			[DELETED]: 'kept from a deleted heading'
		});
	});

	it('clearing a field removes its value', async () => {
		await updateClient(baseFields({ [clientFieldInputName(GOALS)]: '', [clientFieldInputName(HISTORY)]: 'still here' }));
		expect(await customFieldsOf(clientId)).toEqual({
			[HISTORY]: 'still here',
			[DELETED]: 'kept from a deleted heading'
		});
	});

	it('ignores posted values for ids that are not current headings', async () => {
		await updateClient(
			baseFields({
				[clientFieldInputName(GOALS)]: 'g',
				[clientFieldInputName(HISTORY)]: 'h',
				[clientFieldInputName(DELETED)]: 'overwritten?',
				[clientFieldInputName('made-up')]: 'injected'
			})
		);
		const fields = await customFieldsOf(clientId);
		expect(fields[DELETED]).toBe('kept from a deleted heading');
		expect(fields['made-up']).toBeUndefined();
	});

	it('caps a value at 5000 characters', async () => {
		await updateClient(baseFields({ [clientFieldInputName(GOALS)]: 'x'.repeat(6000), [clientFieldInputName(HISTORY)]: 'h' }));
		expect((await customFieldsOf(clientId))[GOALS]).toHaveLength(5000);
	});

	it('another therapist cannot update this client', async () => {
		const other = await mkTherapist();
		const result = await updateClient(baseFields({ [clientFieldInputName(GOALS)]: 'hijacked' }), other.id);
		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: unknown }).data).toEqual({ message: 'Client not found' });
		expect((await customFieldsOf(clientId))[GOALS]).toBe('old goals');
	});

	it('an unknown client id is not found', async () => {
		const result = await updateClient({ ...baseFields(), clientId: 'nope' });
		expect((result as { data: unknown }).data).toEqual({ message: 'Client not found' });
	});
});

describe('settings save — client field headings', () => {
	it('saves headings in order, keeping valid ids and minting ids for new ones', async () => {
		const result = await saveSettings({
			clientFieldHeadingId: [GOALS, '', 'not-a-uuid'],
			clientFieldHeadingLabel: ['Goals', 'Medication', 'History']
		});
		expect(result).toEqual({ saved: true });

		const headings = await getClientFieldHeadings(therapistId);
		const labels: string[] = [];
		for (const heading of headings) {
			labels.push(heading.label);
		}
		expect(labels).toEqual(['Goals', 'Medication', 'History']);
		expect(headings[0].id).toBe(GOALS);
		expect(headings[1].id).toMatch(/^[0-9a-f-]{36}$/);
		expect(headings[2].id).not.toBe('not-a-uuid');
	});

	it('a second save with the same ids keeps them stable, so client values stay attached', async () => {
		await saveSettings({ clientFieldHeadingId: [GOALS], clientFieldHeadingLabel: ['Goals'] });
		await saveSettings({ clientFieldHeadingId: [GOALS], clientFieldHeadingLabel: ['Therapy goals'] });
		expect(await getClientFieldHeadings(therapistId)).toEqual([{ id: GOALS, label: 'Therapy goals' }]);
	});

	it('drops blank labels, and no headings at all clears them', async () => {
		await saveSettings({ clientFieldHeadingId: [GOALS, HISTORY], clientFieldHeadingLabel: ['Goals', '   '] });
		expect(await getClientFieldHeadings(therapistId)).toEqual([{ id: GOALS, label: 'Goals' }]);

		await saveSettings({});
		expect(await getClientFieldHeadings(therapistId)).toEqual([]);
	});

	it('rejects duplicate labels, over-long labels and too many headings — and saves nothing', async () => {
		await saveSettings({ clientFieldHeadingId: [GOALS], clientFieldHeadingLabel: ['Goals'] });

		const duplicate = await saveSettings({ clientFieldHeadingId: ['', ''], clientFieldHeadingLabel: ['Goals', 'goals'] });
		expect((duplicate as { status: number }).status).toBe(400);

		const tooLong = await saveSettings({ clientFieldHeadingId: [''], clientFieldHeadingLabel: ['x'.repeat(61)] });
		expect((tooLong as { status: number }).status).toBe(400);

		const labels: string[] = [];
		const ids: string[] = [];
		for (let i = 0; i < 21; i++) {
			labels.push(`Heading ${i}`);
			ids.push('');
		}
		const tooMany = await saveSettings({ clientFieldHeadingId: ids, clientFieldHeadingLabel: labels });
		expect((tooMany as { status: number }).status).toBe(400);

		expect(await getClientFieldHeadings(therapistId)).toEqual([{ id: GOALS, label: 'Goals' }]);
	});

	it('a duplicated id gets a fresh one instead of merging two headings', async () => {
		await saveSettings({ clientFieldHeadingId: [GOALS, GOALS], clientFieldHeadingLabel: ['Goals', 'History'] });
		const headings = await getClientFieldHeadings(therapistId);
		expect(headings[0].id).toBe(GOALS);
		expect(headings[1].id).not.toBe(GOALS);
	});
});
