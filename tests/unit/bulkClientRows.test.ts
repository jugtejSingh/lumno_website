import { describe, it, expect } from 'vitest';
import { flagRows, parseRate } from '$lib/bulkClientRows';

describe('parseRate', () => {
	it('keeps whole numbers from 0 up', () => {
		expect(parseRate(0)).toBe(0);
		expect(parseRate(60)).toBe(60);
	});

	it('drops anything that is not a whole number >= 0 within the DB integer range', () => {
		expect(parseRate(null)).toBeNull();
		expect(parseRate(undefined)).toBeNull();
		expect(parseRate('60')).toBeNull();
		expect(parseRate('abc')).toBeNull();
		expect(parseRate(-5)).toBeNull();
		expect(parseRate(60.5)).toBeNull();
		expect(parseRate(Number.NaN)).toBeNull();
		expect(parseRate(3_000_000_000)).toBeNull();
	});
});

describe('flagRows', () => {
	it('passes a clean row with no flags, trimmed', () => {
		const [row] = flagRows([{ name: '  Jane Doe ', email: ' jane@example.com ' }], new Set());
		expect(row).toEqual({ name: 'Jane Doe', email: 'jane@example.com', flags: [] });
	});

	it('flags a bad email and a single-word name', () => {
		const [row] = flagRows([{ name: 'Jane', email: 'not-an-email' }], new Set());
		expect(row.flags).toEqual(['invalid_email', 'missing_last_name']);
	});

	it('flags a missing email as invalid', () => {
		const [row] = flagRows([{ name: 'Jane Doe', email: '' }], new Set());
		expect(row.flags).toEqual(['invalid_email']);
	});

	it('flags only the second copy of a repeated email, case-insensitively', () => {
		const rows = flagRows(
			[
				{ name: 'Jane Doe', email: 'jane@example.com' },
				{ name: 'Jane D', email: 'JANE@example.com' }
			],
			new Set()
		);
		expect(rows[0].flags).toEqual([]);
		expect(rows[1].flags).toEqual(['duplicate_in_list']);
	});

	it('keeps the rate on each row untouched', () => {
		const [row] = flagRows([{ name: 'Jane Doe', email: 'jane@example.com', rate: 60 }], new Set());
		expect(row.rate).toBe(60);
	});

	it('flags someone who is already a client', () => {
		const [row] = flagRows([{ name: 'Sam Lee', email: 'Sam@Example.com' }], new Set(['sam@example.com']));
		expect(row.flags).toEqual(['existing_client']);
	});
});
