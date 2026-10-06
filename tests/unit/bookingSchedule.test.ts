import { describe, it, expect } from 'vitest';
import { isTooSoonAfterLastHold } from '../../src/lib/bookingSchedule';
import { bookingWindowEnd } from '../../src/lib/server/bookingWindow';

const DAY_MS = 24 * 60 * 60 * 1000;
const tuesday = new Date('2026-10-13T04:30:00.000Z');

function daysBefore(date: Date, days: number): Date {
	return new Date(date.getTime() - days * DAY_MS);
}

describe('isTooSoonAfterLastHold', () => {
	it('never skips a weekly slot', () => {
		expect(isTooSoonAfterLastHold(tuesday, [daysBefore(tuesday, 7)], 1)).toBe(false);
	});

	it('books the first session: nothing earlier to count from', () => {
		expect(isTooSoonAfterLastHold(tuesday, [], 2)).toBe(false);
		expect(isTooSoonAfterLastHold(tuesday, [], 4)).toBe(false);
	});

	it('skips the week after a session on an every-2-weeks slot, then books the next', () => {
		expect(isTooSoonAfterLastHold(tuesday, [daysBefore(tuesday, 7)], 2)).toBe(true);
		expect(isTooSoonAfterLastHold(tuesday, [daysBefore(tuesday, 14)], 2)).toBe(false);
	});

	it('skips three weeks after a session on an every-4-weeks slot, then books the fourth', () => {
		expect(isTooSoonAfterLastHold(tuesday, [daysBefore(tuesday, 7)], 4)).toBe(true);
		expect(isTooSoonAfterLastHold(tuesday, [daysBefore(tuesday, 21)], 4)).toBe(true);
		expect(isTooSoonAfterLastHold(tuesday, [daysBefore(tuesday, 28)], 4)).toBe(false);
	});

	it('counts the latest of several earlier sessions', () => {
		const holds = [daysBefore(tuesday, 28), daysBefore(tuesday, 14), daysBefore(tuesday, 7)];
		expect(isTooSoonAfterLastHold(tuesday, holds, 2)).toBe(true);
	});

	it('ignores sessions after the date', () => {
		const later = new Date(tuesday.getTime() + 7 * DAY_MS);
		expect(isTooSoonAfterLastHold(tuesday, [later], 2)).toBe(false);
	});

	it('still books exactly 2 weeks later when a clock change makes it an hour short', () => {
		const anHourShort = new Date(tuesday.getTime() - (14 * DAY_MS - 60 * 60 * 1000));
		expect(isTooSoonAfterLastHold(tuesday, [anHourShort], 2)).toBe(false);
	});
});

describe('bookingWindowEnd', () => {
	// 15:30 on Tue 6 Oct 2026 in Kolkata (+5:30)
	const afternoon = new Date('2026-10-06T10:00:00.000Z');

	it('ends at local midnight after the last open day', () => {
		// 14 days ahead from the 6th: the 20th is the last open day, so the window ends 00:00 on the 21st
		expect(bookingWindowEnd(afternoon, 'Asia/Kolkata', 14).toISOString()).toBe('2026-10-20T18:30:00.000Z');
	});

	it('is one day further out for reserved sessions (window + 1)', () => {
		expect(bookingWindowEnd(afternoon, 'Asia/Kolkata', 15).toISOString()).toBe('2026-10-21T18:30:00.000Z');
	});

	it('moves on at local midnight, not before: 23:59 is still the 6th, 00:00 is the 7th', () => {
		const lastMinute = new Date('2026-10-06T18:29:00.000Z');
		const midnight = new Date('2026-10-06T18:30:00.000Z');
		expect(bookingWindowEnd(lastMinute, 'Asia/Kolkata', 14).toISOString()).toBe('2026-10-20T18:30:00.000Z');
		expect(bookingWindowEnd(midnight, 'Asia/Kolkata', 14).toISOString()).toBe('2026-10-21T18:30:00.000Z');
	});

	it('works for the 1-week and 1-month options', () => {
		expect(bookingWindowEnd(afternoon, 'Asia/Kolkata', 7).toISOString()).toBe('2026-10-13T18:30:00.000Z');
		expect(bookingWindowEnd(afternoon, 'Asia/Kolkata', 28).toISOString()).toBe('2026-11-03T18:30:00.000Z');
	});
});
