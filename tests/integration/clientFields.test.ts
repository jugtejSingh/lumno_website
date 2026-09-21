import { describe, it, expect, beforeEach } from 'vitest';
import {
	getClientFieldHeadings,
	mergeClientFieldValues,
	parseClientFieldHeadings,
	updateClientFieldHeadings
} from '$lib/server/clientFields';
import { clientFieldInputName } from '$lib/types/clientFields';
import { resetDb, mkTherapist } from './helpers';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

let therapistId: string;

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist()).id;
});

describe('parseClientFieldHeadings', () => {
	it('keeps posted UUIDs and order, trims labels, drops blank rows', () => {
		const result = parseClientFieldHeadings([ID_B, '', ID_A], [' Medication ', '  ', 'Goals']);
		expect(result).toEqual({
			headings: [
				{ id: ID_B, label: 'Medication' },
				{ id: ID_A, label: 'Goals' }
			]
		});
	});

	it('mints a fresh id for missing, malformed or repeated ids', () => {
		const result = parseClientFieldHeadings(['nope', ID_A, ID_A], ['One', 'Two', 'Three']);
		if (!('headings' in result)) throw new Error('expected headings');
		const ids = new Set<string>();
		for (const heading of result.headings) {
			ids.add(heading.id);
		}
		expect(ids.size).toBe(3);
		expect(result.headings[1].id).toBe(ID_A);
	});

	it('rejects duplicate labels (case-insensitive) and more than 20 headings', () => {
		expect(parseClientFieldHeadings(['', ''], ['Goals', 'goals'])).toHaveProperty('error');

		const labels: string[] = [];
		for (let i = 0; i < 21; i++) {
			labels.push(`Heading ${i}`);
		}
		expect(parseClientFieldHeadings([], labels)).toHaveProperty('error');
	});
});

describe('mergeClientFieldValues', () => {
	it('sets and clears current headings but keeps values of deleted headings', () => {
		const form = new FormData();
		form.set(clientFieldInputName(ID_A), '  new value ');
		form.set(clientFieldInputName(ID_B), '');
		const merged = mergeClientFieldValues(
			{ [ID_B]: 'old b', 'deleted-heading': 'kept' },
			[
				{ id: ID_A, label: 'A' },
				{ id: ID_B, label: 'B' }
			],
			form
		);
		expect(merged).toEqual({ [ID_A]: 'new value', 'deleted-heading': 'kept' });
	});
});

describe('client field headings storage', () => {
	it('starts empty and round-trips through therapist_settings', async () => {
		expect(await getClientFieldHeadings(therapistId)).toEqual([]);
		await updateClientFieldHeadings(therapistId, [{ id: ID_A, label: 'Goals' }]);
		expect(await getClientFieldHeadings(therapistId)).toEqual([{ id: ID_A, label: 'Goals' }]);
	});
});
