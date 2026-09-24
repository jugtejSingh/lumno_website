import { describe, it, expect } from 'vitest';
import { parsePhone } from '../../src/lib/phone';

describe('parsePhone', () => {
	it('treats blank input as no number', () => {
		expect(parsePhone('')).toEqual({ phone: null });
		expect(parsePhone('   ')).toEqual({ phone: null });
		expect(parsePhone(null)).toEqual({ phone: null });
		expect(parsePhone(undefined)).toEqual({ phone: null });
	});

	it('accepts E.164 numbers with 1, 2 and 3-digit country codes', () => {
		expect(parsePhone('+919876543210')).toEqual({ phone: '+919876543210' });
		expect(parsePhone('+12025550123')).toEqual({ phone: '+12025550123' });
		expect(parsePhone('+998912345678')).toEqual({ phone: '+998912345678' });
	});

	it('rejects spaces, dashes and parentheses', () => {
		expect(parsePhone('+91 98765 43210')).toHaveProperty('error');
		expect(parsePhone('(020) 7946-0958')).toHaveProperty('error');
	});

	it('rejects junk, too-short and too-long input', () => {
		expect(parsePhone('not a phone')).toHaveProperty('error');
		expect(parsePhone('+1234567')).toHaveProperty('error');
		expect(parsePhone('+1' + '2'.repeat(15))).toHaveProperty('error');
	});

	it('rejects a punctuation-only string with no digits', () => {
		expect(parsePhone('()()()-----')).toHaveProperty('error');
	});

	it('rejects a missing leading plus', () => {
		expect(parsePhone('919876543210')).toHaveProperty('error');
	});
});
