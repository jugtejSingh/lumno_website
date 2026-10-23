import { describe, it, expect } from 'vitest';
import { formatTime, ordinal } from '../../src/lib/format';

describe('ordinal', () => {
	it('uses st, nd, rd for 1, 2, 3 and th otherwise', () => {
		expect(ordinal(1)).toBe('1st');
		expect(ordinal(2)).toBe('2nd');
		expect(ordinal(3)).toBe('3rd');
		expect(ordinal(4)).toBe('4th');
		expect(ordinal(21)).toBe('21st');
		expect(ordinal(22)).toBe('22nd');
		expect(ordinal(23)).toBe('23rd');
		expect(ordinal(30)).toBe('30th');
	});

	it('uses th for the teens, including 111-113', () => {
		expect(ordinal(11)).toBe('11th');
		expect(ordinal(12)).toBe('12th');
		expect(ordinal(13)).toBe('13th');
		expect(ordinal(111)).toBe('111th');
	});
});

describe('formatTime', () => {
	const at = new Date('2026-10-23T04:30:00Z');

	it('gives "10:00 AM" style with a plain space', () => {
		expect(formatTime(at, 'Asia/Kolkata')).toBe('10:00 AM');
	});

	it('formats in the given timezone', () => {
		expect(formatTime(at, 'America/New_York')).toBe('12:30 AM');
	});
});
