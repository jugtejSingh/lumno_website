import { describe, it, expect, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { getSlotDesign, setDateOverride, toDateKey } from '$lib/server/availabilitySlots';
import { getBookingNote, BOOKING_NOTE_MAX_LENGTH } from '$lib/server/bookingNote';
import { actions } from '../../src/routes/(app)/calendar/+page.server';
import { resetDb, mkTherapist, mkClient, mkSlot, mkEvent, dateAhead } from './helpers';

// The slot designer's form actions: plain form fields, validated, then written.

let therapistId: string;

const MAX_MESSAGE = 'Max sessions must be a whole number from 1 to 50, or blank for no limit';
const UNREADABLE_SLOT = 'Could not read that slot — reload and try again';
const SLOT_NOT_FOUND = 'That slot could not be found — reload and try again';
const HYBRID_MESSAGE = 'A slot where the client picks online or in person can’t be reserved';
const RESERVED_OVERLAP = 'A reserved slot can’t overlap another slot on the same day';

function post(action: keyof typeof actions, fields: Record<string, string | string[]>) {
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

describe('addSlot', () => {
	const valid = { weekday: '1', startTime: '09:00', endTime: '10:00', modality: 'online' };

	it('saves an open slot for the signed-in therapist', async () => {
		const result = await post('addSlot', valid);
		expect(isActionFailure(result)).toBe(false);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].slots).toHaveLength(1);
		expect(design.week[1].slots[0]).toMatchObject({ startTime: '09:00', endTime: '10:00', modality: 'online' });
		expect(design.week[1].slots[0].reservedClientId).toBeNull();
	});

	it('rejects a bad time, end before start, an unknown modality and a bad weekday, and writes nothing', async () => {
		expect(failure(await post('addSlot', { ...valid, startTime: '9am' }))).toEqual({
			status: 400,
			message: 'Every slot needs a valid start and end time'
		});
		expect(failure(await post('addSlot', { ...valid, startTime: '10:00', endTime: '09:00' })).message).toBe(
			'Every slot must end after it starts'
		);
		expect(failure(await post('addSlot', { ...valid, modality: 'phone' })).message).toBe(
			'Every slot needs online, in person or hybrid'
		);
		expect(failure(await post('addSlot', { ...valid, weekday: '7' })).message).toBe(UNREADABLE_SLOT);
		expect(failure(await post('addSlot', { ...valid, weekday: '' })).message).toBe(UNREADABLE_SLOT);

		const design = await getSlotDesign(therapistId, 2027, 0);
		for (const day of design.week) {
			expect(day.slots).toHaveLength(0);
		}
	});

	it('rejects a slot that overlaps a reserved slot', async () => {
		const reservedFor = await mkClient(therapistId);
		await mkSlot(therapistId, { weekday: 1, startTime: '09:30', endTime: '10:30', reservedClientId: reservedFor.id });

		expect(failure(await post('addSlot', valid))).toEqual({ status: 400, message: RESERVED_OVERLAP });
	});
});

describe('updateSlot', () => {
	it('updates the signed-in therapist’s slot', async () => {
		const slot = await mkSlot(therapistId, { weekday: 1 });

		const result = await post('updateSlot', {
			slotId: slot.id,
			weekday: '1',
			startTime: '14:00',
			endTime: '15:00',
			modality: 'hybrid'
		});

		expect(isActionFailure(result)).toBe(false);
		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].slots[0]).toMatchObject({ id: slot.id, startTime: '14:00', modality: 'hybrid' });
	});

	it('rejects invalid input and leaves the slot alone', async () => {
		const slot = await mkSlot(therapistId, { weekday: 1 });
		const fields = { slotId: slot.id, weekday: '1', startTime: '11:00', endTime: '10:00', modality: 'online' };

		expect(failure(await post('updateSlot', fields))).toEqual({
			status: 400,
			message: 'Every slot must end after it starts'
		});
		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].slots[0].startTime).toBe('10:00');
	});

	it('a reserved slot changed to hybrid is rejected', async () => {
		const reservedFor = await mkClient(therapistId);
		const slot = await mkSlot(therapistId, { weekday: 1, reservedClientId: reservedFor.id });

		const result = await post('updateSlot', {
			slotId: slot.id,
			weekday: '1',
			startTime: '10:00',
			endTime: '11:00',
			modality: 'hybrid'
		});

		expect(failure(result)).toEqual({ status: 400, message: HYBRID_MESSAGE });
	});

	it('refuses another therapist’s slot', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const theirs = await mkSlot(other.id, { weekday: 1 });

		const result = await post('updateSlot', {
			slotId: theirs.id,
			weekday: '2',
			startTime: '14:00',
			endTime: '15:00',
			modality: 'online'
		});

		expect(failure(result)).toEqual({ status: 400, message: SLOT_NOT_FOUND });
		const design = await getSlotDesign(other.id, 2027, 0);
		expect(design.week[1].slots).toHaveLength(1);
	});
});

describe('deleteSlot', () => {
	it('deletes the signed-in therapist’s slot', async () => {
		const slot = await mkSlot(therapistId, { weekday: 1 });

		expect(isActionFailure(await post('deleteSlot', { slotId: slot.id }))).toBe(false);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].slots).toHaveLength(0);
	});

	it('refuses another therapist’s slot, and a missing id', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const theirs = await mkSlot(other.id, { weekday: 1 });

		expect(failure(await post('deleteSlot', { slotId: theirs.id }))).toEqual({ status: 400, message: SLOT_NOT_FOUND });
		expect(failure(await post('deleteSlot', {}))).toEqual({ status: 400, message: SLOT_NOT_FOUND });
		const design = await getSlotDesign(other.id, 2027, 0);
		expect(design.week[1].slots).toHaveLength(1);
	});
});

describe('reserveSlot', () => {
	it('returns the booking counts to the page', async () => {
		const reservedFor = await mkClient(therapistId);
		const slot = await mkSlot(therapistId, { weekday: dateAhead(3).weekday });

		const result = await post('reserveSlot', { slotId: slot.id, clientId: reservedFor.id });

		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ booking: { created: 2, blocked: 0, failed: 0 } });
	});

	it('a blank client releases the slot', async () => {
		const reservedFor = await mkClient(therapistId);
		const slot = await mkSlot(therapistId, { weekday: 1, reservedClientId: reservedFor.id });

		expect(isActionFailure(await post('reserveSlot', { slotId: slot.id, clientId: '' }))).toBe(false);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].slots[0].reservedClientId).toBeNull();
	});

	it('rejects a hybrid slot, an unknown slot, another therapist’s client and an overlapping slot', async () => {
		const reservedFor = await mkClient(therapistId);
		const other = await mkTherapist({ timezone: 'UTC' });
		const stranger = await mkClient(other.id);
		const hybrid = await mkSlot(therapistId, { weekday: 1, modality: 'hybrid' });
		const open = await mkSlot(therapistId, { weekday: 2 });
		const overlapped = await mkSlot(therapistId, { weekday: 3, startTime: '10:00', endTime: '11:00' });
		await mkSlot(therapistId, { weekday: 3, startTime: '10:30', endTime: '11:30' });

		expect(failure(await post('reserveSlot', { slotId: hybrid.id, clientId: reservedFor.id }))).toEqual({
			status: 400,
			message: HYBRID_MESSAGE
		});
		expect(
			failure(await post('reserveSlot', { slotId: '00000000-0000-0000-0000-000000000000', clientId: reservedFor.id }))
				.message
		).toBe(SLOT_NOT_FOUND);
		expect(failure(await post('reserveSlot', { slotId: open.id, clientId: stranger.id })).message).toBe(
			'That client could not be found'
		);
		expect(failure(await post('reserveSlot', { slotId: overlapped.id, clientId: reservedFor.id })).message).toBe(
			RESERVED_OVERLAP
		);
	});
});

describe('saveWeekDay', () => {
	it('saves one weekday’s cap and holiday', async () => {
		const result = await post('saveWeekDay', { weekday: '1', maxSessions: '3', holiday: 'on' });
		expect(isActionFailure(result)).toBe(false);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].maxSessions).toBe(3);
		expect(design.week[1].holiday).toBe(true);
	});

	it('a blank cap is no limit, and an unticked holiday is off', async () => {
		await post('saveWeekDay', { weekday: '1', maxSessions: '3', holiday: 'on' });
		await post('saveWeekDay', { weekday: '1', maxSessions: '' });

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].maxSessions).toBeNull();
		expect(design.week[1].holiday).toBe(false);
	});

	it('rejects caps outside 1–50 and a bad weekday', async () => {
		const bad = ['0', '51', '2.5', 'abc', '-1'];
		for (const value of bad) {
			expect(failure(await post('saveWeekDay', { weekday: '1', maxSessions: value }))).toEqual({
				status: 400,
				message: MAX_MESSAGE
			});
		}
		expect(failure(await post('saveWeekDay', { weekday: '9', maxSessions: '' })).message).toBe(UNREADABLE_SLOT);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].maxSessions).toBeNull();
	});
});

describe('copyDay', () => {
	it('copies the source day onto every chosen target day', async () => {
		await mkSlot(therapistId, { weekday: 1, startTime: '09:00', endTime: '10:00' });

		const result = await post('copyDay', { fromWeekday: '1', targets: ['2', '4'] });

		expect(isActionFailure(result)).toBe(false);
		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[2].slots).toHaveLength(1);
		expect(design.week[4].slots).toHaveLength(1);
		expect(design.week[3].slots).toHaveLength(0);
	});

	it('rejects a bad source or target weekday and writes nothing', async () => {
		await mkSlot(therapistId, { weekday: 1 });

		expect(failure(await post('copyDay', { fromWeekday: '8', targets: ['2'] }))).toEqual({
			status: 400,
			message: UNREADABLE_SLOT
		});
		expect(failure(await post('copyDay', { fromWeekday: '1', targets: ['2', 'x'] })).message).toBe(UNREADABLE_SLOT);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[2].slots).toHaveLength(0);
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

describe('saveBookingNote', () => {
	it('saves the note for the signed-in therapist', async () => {
		const result = await post('saveBookingNote', { bookingNote: '  Pay before the session.  ' });
		expect(isActionFailure(result)).toBe(false);
		expect(await getBookingNote(therapistId)).toBe('Pay before the session.');
	});

	it('clears the note when submitted blank', async () => {
		await post('saveBookingNote', { bookingNote: 'something' });
		await post('saveBookingNote', { bookingNote: '' });
		expect(await getBookingNote(therapistId)).toBe('');
	});

	it('rejects a note over the length cap and leaves the saved one alone', async () => {
		await post('saveBookingNote', { bookingNote: 'original' });

		const result = await post('saveBookingNote', { bookingNote: 'a'.repeat(BOOKING_NOTE_MAX_LENGTH + 1) });
		if (!isActionFailure(result)) {
			throw new Error('expected a failure');
		}
		expect(result.status).toBe(400);
		expect((result.data as unknown as { noteMessage: string }).noteMessage).toContain('under');
		expect(await getBookingNote(therapistId)).toBe('original');
	});

	it('never touches another therapist’s note', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		await post('saveBookingNote', { bookingNote: 'mine' });
		expect(await getBookingNote(other.id)).toBe('');
	});
});
