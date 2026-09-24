import { describe, it, expect } from 'vitest';
import { parseMonthParam } from '$lib/server/dateParams';

const now = new Date('2026-03-15T00:00:00Z'); // month index 2

describe('parseMonthParam', () => {
	it('accepts a valid month index', () => {
		expect(parseMonthParam('0', now)).toBe(0);
		expect(parseMonthParam('11', now)).toBe(11);
	});

	it('falls back to the current month when the param is missing', () => {
		expect(parseMonthParam(null, now)).toBe(2);
	});

	it('falls back to the current month for non-numeric garbage instead of NaN', () => {
		expect(parseMonthParam('abc', now)).toBe(2);
	});

	it('falls back to the current month for an out-of-range value', () => {
		expect(parseMonthParam('99', now)).toBe(2);
		expect(parseMonthParam('-1', now)).toBe(2);
	});
});
