import { describe, it, expect, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { getSlotDesign, setDateOverride, toDateKey } from '$lib/server/availabilitySlots';
import type { DesignedDay } from '$lib/types/slots';
import { actions } from '../../src/routes/(app)/calendar/+page.server';
import { resetDb, mkTherapist, mkEvent } from './helpers';

// The slot designer's three form actions: JSON in a form field, validated, then written.

let therapistId: string;

const MAX_MESSAGE = 'Max sessions must be a whole number from 1 to 50, or blank for no limit';
const UNREADABLE_WEEK = 'Could not read your weekly slots — reload and try again';

function emptyWeek(): DesignedDay[] {
	const week: DesignedDay[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		week.push({ slots: [], maxSessions: null });
	}
	return week;
}

function post(action: keyof typeof actions, fields: Record<string, string>) {
	return actions[action](mkEvent({ locals: { therapistId }, fields }) as never);
}

// the failure's { status, message }, or throws if the action succeeded
function failure(result: unknown) {
	if (!isActionFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result)}`);
	}
	return { status: result.status, message: (result.data as unknown as { message: string }).message };
}

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ timezone: 'UTC' })).id;
});

describe('saveWeekTemplate', () => {
	it('saves a valid week', async () => {
		const week = emptyWeek();
		week[1] = { slots: [{ startTime: '09:00', endTime: '10:00', modality: 'online' }], maxSessions: 3 };
		const result = await post('saveWeekTemplate', { week: JSON.stringify(week) });
		expect(isActionFailure(result)).toBe(false);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1]).toEqual(week[1]);
	});

	it('accepts a blank-string cap as no limit', async () => {
		const week = emptyWeek() as unknown as { slots: unknown[]; maxSessions: unknown }[];
		week[2] = { slots: [{ startTime: '09:00', endTime: '10:00', modality: 'online' }], maxSessions: '' };
		expect(isActionFailure(await post('saveWeekTemplate', { week: JSON.stringify(week) }))).toBe(false);
	});

	it('rejects bad JSON, the wrong number of days, and non-object days', async () => {
		expect(failure(await post('saveWeekTemplate', { week: 'not json' }))).toEqual({ status: 400, message: UNREADABLE_WEEK });
		expect(failure(await post('saveWeekTemplate', {}))).toEqual({ status: 400, message: UNREADABLE_WEEK });
		expect(failure(await post('saveWeekTemplate', { week: JSON.stringify(emptyWeek().slice(0, 6)) })).message).toBe(
			UNREADABLE_WEEK
		);
		const withNull: unknown[] = emptyWeek();
		withNull[3] = null;
		expect(failure(await post('saveWeekTemplate', { week: JSON.stringify(withNull) })).message).toBe(UNREADABLE_WEEK);
		const badSlots: unknown[] = emptyWeek();
		badSlots[3] = { slots: 'nope', maxSessions: null };
		expect(failure(await post('saveWeekTemplate', { week: JSON.stringify(badSlots) })).message).toBe(UNREADABLE_WEEK);
	});

	it('rejects overlapping, backwards and unknown-modality slots', async () => {
		const overlapping = emptyWeek();
		overlapping[1].slots = [
			{ startTime: '09:00', endTime: '10:00', modality: 'online' },
			{ startTime: '09:30', endTime: '10:30', modality: 'online' }
		];
		expect(failure(await post('saveWeekTemplate', { week: JSON.stringify(overlapping) })).message).toBe(
			'Slots on the same day can’t overlap'
		);

		const backwards = emptyWeek();
		backwards[1].slots = [{ startTime: '10:00', endTime: '09:00', modality: 'online' }];
		expect(failure(await post('saveWeekTemplate', { week: JSON.stringify(backwards) })).message).toBe(
			'Every slot must end after it starts'
		);

		const badModality = emptyWeek() as unknown as { slots: unknown[]; maxSessions: null }[];
		badModality[1].slots = [{ startTime: '09:00', endTime: '10:00', modality: 'phone' }];
		expect(failure(await post('saveWeekTemplate', { week: JSON.stringify(badModality) })).message).toBe(
			'Every slot needs online, in person or hybrid'
		);
	});

	it('rejects caps outside 1–50', async () => {
		const bad = [0, 51, 2.5, 'abc', -1];
		for (const value of bad) {
			const week = emptyWeek() as unknown as { slots: unknown[]; maxSessions: unknown }[];
			week[0].maxSessions = value;
			expect(failure(await post('saveWeekTemplate', { week: JSON.stringify(week) })).message).toBe(MAX_MESSAGE);
		}
	});

	it('writes nothing when any day is invalid', async () => {
		const first = emptyWeek();
		first[1] = { slots: [{ startTime: '09:00', endTime: '10:00', modality: 'online' }], maxSessions: null };
		await post('saveWeekTemplate', { week: JSON.stringify(first) });

		const bad = emptyWeek();
		bad[0] = { slots: [{ startTime: '11:00', endTime: '12:00', modality: 'online' }], maxSessions: null };
		bad[6] = { slots: [{ startTime: '12:00', endTime: '11:00', modality: 'online' }], maxSessions: null };
		await post('saveWeekTemplate', { week: JSON.stringify(bad) });

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].slots).toHaveLength(1);
		expect(design.week[0].slots).toHaveLength(0);
	});
});

describe('saveDateOverride', () => {
	const dateFields = { year: '2027', month: '0', day: '15' };
	const oneSlot = JSON.stringify([{ startTime: '14:00', endTime: '15:00', modality: 'hybrid' }]);

	it('saves the date’s slots and cap', async () => {
		const result = await post('saveDateOverride', { ...dateFields, slots: oneSlot, maxSessions: '1' });
		expect(isActionFailure(result)).toBe(false);
		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.overrides['2027-01-15']).toEqual({
			slots: [{ startTime: '14:00', endTime: '15:00', modality: 'hybrid' }],
			maxSessions: 1
		});
	});

	it('an empty slot list saves a day off; a missing cap means no limit', async () => {
		await post('saveDateOverride', { ...dateFields, slots: '[]' });
		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.overrides['2027-01-15']).toEqual({ slots: [], maxSessions: null });
	});

	it('rejects an impossible date', async () => {
		const result = await post('saveDateOverride', { year: '2027', month: '1', day: '30', slots: '[]' });
		expect(failure(result)).toEqual({ status: 400, message: 'Pick a valid date' });
	});

	it('rejects unreadable or invalid slots and a bad cap', async () => {
		expect(failure(await post('saveDateOverride', { ...dateFields, slots: '{' })).message).toBe(
			'Could not read that day’s slots — reload and try again'
		);
		expect(
			failure(
				await post('saveDateOverride', {
					...dateFields,
					slots: JSON.stringify([{ startTime: '9am', endTime: '10:00', modality: 'online' }])
				})
			).message
		).toBe('Every slot needs a valid start and end time');
		expect(failure(await post('saveDateOverride', { ...dateFields, slots: oneSlot, maxSessions: '0' })).message).toBe(
			MAX_MESSAGE
		);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.overrides).toEqual({});
	});
});

describe('clearDateOverride', () => {
	it('removes the date override for the signed-in therapist only', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const dateKey = toDateKey(2027, 0, 15);
		await setDateOverride(therapistId, dateKey, { slots: [], maxSessions: null });
		await setDateOverride(other.id, dateKey, { slots: [], maxSessions: null });

		const result = await post('clearDateOverride', { year: '2027', month: '0', day: '15' });
		expect(isActionFailure(result)).toBe(false);

		expect((await getSlotDesign(therapistId, 2027, 0)).overrides).toEqual({});
		expect(Object.keys((await getSlotDesign(other.id, 2027, 0)).overrides)).toEqual([dateKey]);
	});

	it('rejects an invalid date', async () => {
		expect(failure(await post('clearDateOverride', { year: '2027', month: '13', day: '1' }))).toEqual({
			status: 400,
			message: 'Pick a valid date'
		});
	});
});
