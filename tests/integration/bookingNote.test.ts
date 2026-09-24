import { describe, it, expect, beforeEach } from 'vitest';
import { getBookingNote, setBookingNote, BOOKING_NOTE_MAX_LENGTH } from '$lib/server/bookingNote';
import { resetDb, mkTherapist } from './helpers';

// The therapist's note shown on the client booking calendar.

let therapistId: string;

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist()).id;
});

describe('booking note', () => {
	it('is an empty string until the therapist writes one', async () => {
		expect(await getBookingNote(therapistId)).toBe('');
	});

	it('saves and reads back the note', async () => {
		await setBookingNote(therapistId, 'Payment is due before the session starts.');
		expect(await getBookingNote(therapistId)).toBe('Payment is due before the session starts.');
	});

	it('trims surrounding whitespace', async () => {
		await setBookingNote(therapistId, '  pay first  \n');
		expect(await getBookingNote(therapistId)).toBe('pay first');
	});

	it('keeps line breaks inside the note', async () => {
		await setBookingNote(therapistId, 'line one\nline two');
		expect(await getBookingNote(therapistId)).toBe('line one\nline two');
	});

	it('clears the note when saved blank', async () => {
		await setBookingNote(therapistId, 'something');
		await setBookingNote(therapistId, '   ');
		expect(await getBookingNote(therapistId)).toBe('');
	});

	it('truncates a note longer than the cap', async () => {
		await setBookingNote(therapistId, 'a'.repeat(BOOKING_NOTE_MAX_LENGTH + 50));
		const saved = await getBookingNote(therapistId);
		expect(saved).toHaveLength(BOOKING_NOTE_MAX_LENGTH);
	});

	it('keeps each therapist’s note separate', async () => {
		const other = (await mkTherapist()).id;
		await setBookingNote(therapistId, 'mine');
		await setBookingNote(other, 'theirs');

		expect(await getBookingNote(therapistId)).toBe('mine');
		expect(await getBookingNote(other)).toBe('theirs');
	});
});
