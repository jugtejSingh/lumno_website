import { isCountryCode } from '$lib/countries';

// Details the client gives about themselves when accepting an invite (and can fix
// later from the portal). The therapist sees these but never edits them.
export type ClientProfile = {
	dateOfBirth: string; // YYYY-MM-DD
	gender: string;
	city: string;
	state: string;
	country: string; // ISO 3166-1 alpha-2
};

export type ParsedClientProfile = { profile: ClientProfile } | { error: string };

const MAX_TEXT_LENGTH = 100;
const MAX_AGE_YEARS = 120;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GENDER_SUGGESTIONS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

function readText(form: FormData, key: string): string {
	return (form.get(key)?.toString() ?? '').trim();
}

// All five are required. Checked before any account is created or touched.
export function parseClientProfile(form: FormData, today: Date = new Date()): ParsedClientProfile {
	const dateOfBirth = readText(form, 'dateOfBirth');
	const gender = readText(form, 'gender');
	const city = readText(form, 'city');
	const state = readText(form, 'state');
	const country = readText(form, 'country').toUpperCase();

	if (!DATE_RE.test(dateOfBirth)) {
		return { error: 'Enter your date of birth.' };
	}
	const dob = new Date(`${dateOfBirth}T00:00:00Z`);
	// round-trip catches impossible dates like 2001-02-30
	if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== dateOfBirth) {
		return { error: 'Enter a valid date of birth.' };
	}
	const oldest = new Date(today);
	oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_AGE_YEARS);
	if (dob > today || dob < oldest) {
		return { error: 'Enter a valid date of birth.' };
	}

	if (!gender) {
		return { error: 'Enter your gender.' };
	}
	if (!city) {
		return { error: 'Enter your city or town.' };
	}
	if (!state) {
		return { error: 'Enter your state.' };
	}
	if (gender.length > MAX_TEXT_LENGTH || city.length > MAX_TEXT_LENGTH || state.length > MAX_TEXT_LENGTH) {
		return { error: `Keep each answer to ${MAX_TEXT_LENGTH} characters or fewer.` };
	}
	if (!isCountryCode(country)) {
		return { error: 'Choose your country.' };
	}

	return { profile: { dateOfBirth, gender, city, state, country } };
}

// Whether a client row already carries a complete profile (setClientProfile writes all
// five together, but rows from before this existed have none).
export function hasClientProfile(row: {
	dateOfBirth: string | null;
	gender: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
}): boolean {
	return Boolean(row.dateOfBirth && row.gender && row.city && row.state && row.country);
}

// Whole years between a YYYY-MM-DD birth date and today.
export function ageFromDateOfBirth(dateOfBirth: string, today: Date = new Date()): number {
	const [year, month, day] = dateOfBirth.split('-').map(Number);
	let age = today.getFullYear() - year;
	const beforeBirthday =
		today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
	if (beforeBirthday) {
		age -= 1;
	}
	return age;
}
