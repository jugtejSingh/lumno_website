import { describe, it, expect } from 'vitest';
import { countryForPhone, listCountries, listDialCountries } from '../../src/lib/countries';

describe('listDialCountries', () => {
	it('gives every country and territory a dialling code, India first', () => {
		const dialCountries = listDialCountries();
		expect(dialCountries).toHaveLength(listCountries().length);
		expect(dialCountries[0].country).toBe('IN');
		const guernsey = dialCountries.find((entry) => entry.country === 'GG');
		expect(guernsey?.dialCode).toBe('+44');
	});
});

describe('countryForPhone', () => {
	it('matches the longest code, so +971 is not read as +9x', () => {
		expect(countryForPhone('+971501234567')?.country).toBe('AE');
		expect(countryForPhone('+919810012345')?.country).toBe('IN');
	});

	it('shows a shared code as its main country', () => {
		expect(countryForPhone('+14155550123')?.country).toBe('US');
		expect(countryForPhone('+447700900123')?.country).toBe('GB');
	});

	it('returns null when no code matches', () => {
		expect(countryForPhone('12345')).toBeNull();
	});
});
