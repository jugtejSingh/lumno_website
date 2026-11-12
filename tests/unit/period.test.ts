import { describe, it, expect } from 'vitest';
import { parsePeriod, periodOptions } from '$lib/server/period';

const tz = 'Asia/Kolkata';
// 12 Nov 2026, 10:00 IST
const now = new Date('2026-11-12T04:30:00Z');

describe('parsePeriod', () => {
	it('defaults to the last 30 days with no end', () => {
		const p = parsePeriod(null, tz, now);
		expect(p.kind).toBe('30d');
		expect(p.start.toISOString()).toBe('2026-10-13T04:30:00.000Z');
		expect(p.end).toBeNull();
		expect(p.label).toBe('Last 30 days');
	});

	it('last 365 days has no end', () => {
		const p = parsePeriod('365d', tz, now);
		expect(p.kind).toBe('365d');
		expect(p.start.toISOString()).toBe('2025-11-12T04:30:00.000Z');
		expect(p.end).toBeNull();
	});

	it('a month spans IST midnight to IST midnight', () => {
		const p = parsePeriod('month:2026-10', tz, now);
		expect(p.kind).toBe('month');
		expect(p.start.toISOString()).toBe('2026-09-30T18:30:00.000Z');
		expect(p.end!.toISOString()).toBe('2026-10-31T18:30:00.000Z');
		expect(p.label).toBe('October 2026');
		expect(p.prev).toBe('month:2026-09');
		expect(p.next).toBe('month:2026-11');
	});

	it('02:00 IST on the 1st is inside that month', () => {
		const p = parsePeriod('month:2026-11', tz, now);
		const twoAmIst = new Date('2026-10-31T20:30:00Z');
		expect(twoAmIst >= p.start && twoAmIst < p.end!).toBe(true);
	});

	it('month arrows wrap the year and stop at the current month', () => {
		expect(parsePeriod('month:2026-01', tz, now).prev).toBe('month:2025-12');
		expect(parsePeriod('month:2025-12', tz, now).next).toBe('month:2026-01');
		expect(parsePeriod('month:2026-11', tz, now).next).toBeUndefined();
	});

	it('a year spans Jan to Dec and stops at the current year', () => {
		const p = parsePeriod('year:2025', tz, now);
		expect(p.start.toISOString()).toBe('2024-12-31T18:30:00.000Z');
		expect(p.end!.toISOString()).toBe('2025-12-31T18:30:00.000Z');
		expect(p.prev).toBe('year:2024');
		expect(p.next).toBe('year:2026');
		expect(parsePeriod('year:2026', tz, now).next).toBeUndefined();
	});

	it('invalid or future values fall back to 30d', () => {
		const bad = ['garbage', 'month:2026-13', 'month:2026-00', 'month:2026-12', 'year:2027', 'month:26-1', ''];
		for (const raw of bad) {
			expect(parsePeriod(raw, tz, now).kind).toBe('30d');
		}
	});
});

describe('periodOptions', () => {
	it('Monthly and Yearly open on the current month and year', () => {
		const values = [];
		for (const option of periodOptions(tz, now)) {
			values.push(option.value);
		}
		expect(values).toEqual(['30d', '365d', 'month:2026-11', 'year:2026']);
	});
});
