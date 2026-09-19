import { describe, it, expect } from 'vitest';
import { parsePhone } from '../../src/lib/phone';

describe('parsePhone', () => {
	it('treats blank input as no number', () => {
		expect(parsePhone('')).toEqual({ phone: null });
		expect(parsePhone('   ')).toEqual({ phone: null });
		expect(parsePhone(null)).toEqual({ phone: null });
		expect(parsePhone(undefined)).toEqual({ phone: null });
	});

	it('keeps plausible numbers as typed, trimmed', () => {
		expect(parsePhone(' +91 98765 43210 ')).toEqual({ phone: '+91 98765 43210' });
		expect(parsePhone('(020) 7946-0958')).toEqual({ phone: '(020) 7946-0958' });
	});

	it('rejects junk, too-short and too-long input', () => {
		expect(parsePhone('not a phone')).toHaveProperty('error');
		expect(parsePhone('12345')).toHaveProperty('error');
		expect(parsePhone('1'.repeat(21))).toHaveProperty('error');
		expect(parsePhone('+91 98765 43210 ext 4')).toHaveProperty('error');
	});
});
