import { describe, it, expect } from 'vitest';
import { ageFromDateOfBirth, hasClientProfile, parseClientProfile } from '../../src/lib/clientProfile';

const TODAY = new Date('2026-09-21T12:00:00Z');

function profileForm(over: Record<string, string> = {}): FormData {
	const values: Record<string, string> = {
		dateOfBirth: '1990-05-14',
		gender: 'Female',
		city: 'Pune',
		state: 'Maharashtra',
		country: 'IN',
		...over
	};
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) {
		form.set(key, value);
	}
	return form;
}

describe('parseClientProfile', () => {
	it('accepts a complete profile, trimmed, with the country upper-cased', () => {
		const result = parseClientProfile(profileForm({ city: '  Pune ', country: 'in' }), TODAY);
		expect(result).toEqual({
			profile: {
				dateOfBirth: '1990-05-14',
				gender: 'Female',
				city: 'Pune',
				state: 'Maharashtra',
				country: 'IN'
			}
		});
	});

	it('requires every field', () => {
		for (const key of ['dateOfBirth', 'gender', 'city', 'state', 'country']) {
			expect(parseClientProfile(profileForm({ [key]: '' }), TODAY)).toHaveProperty('error');
		}
	});

	it('rejects impossible, future and implausibly old birth dates', () => {
		expect(parseClientProfile(profileForm({ dateOfBirth: '2001-02-30' }), TODAY)).toHaveProperty('error');
		expect(parseClientProfile(profileForm({ dateOfBirth: '2027-01-01' }), TODAY)).toHaveProperty('error');
		expect(parseClientProfile(profileForm({ dateOfBirth: '1850-01-01' }), TODAY)).toHaveProperty('error');
		expect(parseClientProfile(profileForm({ dateOfBirth: '14/05/1990' }), TODAY)).toHaveProperty('error');
	});

	it('rejects country values that are not ISO codes', () => {
		expect(parseClientProfile(profileForm({ country: 'India' }), TODAY)).toHaveProperty('error');
		expect(parseClientProfile(profileForm({ country: 'XX' }), TODAY)).toHaveProperty('error');
	});
});

describe('ageFromDateOfBirth', () => {
	it('counts whole years, not yet a year older before the birthday', () => {
		expect(ageFromDateOfBirth('1990-09-21', TODAY)).toBe(36);
		expect(ageFromDateOfBirth('1990-09-22', TODAY)).toBe(35);
	});
});

describe('hasClientProfile', () => {
	it('is false when any field is missing', () => {
		const full = { dateOfBirth: '1990-05-14', gender: 'F', city: 'Pune', state: 'MH', country: 'IN' };
		expect(hasClientProfile(full)).toBe(true);
		expect(hasClientProfile({ ...full, country: null })).toBe(false);
	});
});
