import { describe, it, expect } from 'vitest';
import { parseAmount } from '../../src/routes/(app)/payments/+page.server';

describe('parseAmount', () => {
	it('accepts a whole positive number', () => {
		expect(parseAmount('150')).toBe(150);
	});

	it('rejects a fractional amount instead of letting it get rounded downstream', () => {
		expect(parseAmount('150.75')).toBeNull();
	});

	it('rejects zero, negative, and non-numeric input', () => {
		expect(parseAmount('0')).toBeNull();
		expect(parseAmount('-5')).toBeNull();
		expect(parseAmount('abc')).toBeNull();
		expect(parseAmount(null)).toBeNull();
	});
});
