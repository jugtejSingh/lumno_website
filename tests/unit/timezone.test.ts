import { describe, it, expect } from 'vitest';
import {
	zonedDateToUTC,
	zonedDayBounds,
	getZonedWeekday,
	getZonedDateParts,
	parseTimeOfDay
} from '../../src/lib/server/timezone';

describe('zonedDateToUTC', () => {
	it('offsets a fixed-offset zone (Asia/Kolkata, +5:30)', () => {
		// 09:00 wall-clock in Kolkata is 03:30 UTC
		expect(zonedDateToUTC(2026, 0, 15, 9, 0, 'Asia/Kolkata').toISOString()).toBe(
			'2026-01-15T03:30:00.000Z'
		);
	});

	it('respects DST for America/New_York', () => {
		// January: EST (-5) -> 12:00 local is 17:00 UTC
		expect(zonedDateToUTC(2026, 0, 15, 12, 0, 'America/New_York').toISOString()).toBe(
			'2026-01-15T17:00:00.000Z'
		);
		// July: EDT (-4) -> 12:00 local is 16:00 UTC
		expect(zonedDateToUTC(2026, 6, 15, 12, 0, 'America/New_York').toISOString()).toBe(
			'2026-07-15T16:00:00.000Z'
		);
	});

	it('round-trips through getZonedDateParts', () => {
		const utc = zonedDateToUTC(2026, 2, 30, 23, 30, 'America/New_York');
		expect(getZonedDateParts(utc, 'America/New_York')).toEqual({ year: 2026, month: 2, day: 30 });
	});
});

describe('zonedDayBounds', () => {
	it('spans local midnight to midnight', () => {
		const { start, end } = zonedDayBounds(2026, 0, 15, 'Asia/Kolkata');
		expect(start.toISOString()).toBe('2026-01-14T18:30:00.000Z');
		expect(end.toISOString()).toBe('2026-01-15T18:30:00.000Z');
	});
});

describe('getZonedWeekday', () => {
	it('is 0 for Sunday, in the target zone not UTC', () => {
		// 2026-01-15T19:00Z is still Thu in UTC but already Fri 00:30 in Kolkata
		expect(getZonedWeekday(new Date('2026-01-15T12:00:00Z'), 'Asia/Kolkata')).toBe(4); // Thu
		expect(getZonedWeekday(new Date('2026-01-15T19:00:00Z'), 'Asia/Kolkata')).toBe(5); // Fri
	});
});

describe('parseTimeOfDay', () => {
	it('parses an HH:MM:SS postgres time string', () => {
		expect(parseTimeOfDay('09:30:00')).toEqual([9, 30]);
		expect(parseTimeOfDay('20:00')).toEqual([20, 0]);
	});
});
