// Phone numbers are client-supplied and unverified — we only check the shape so a
// stored number is plausibly dialable. Must be entered in E.164 form: a leading
// '+', the country code, then the subscriber number, digits only — no spaces,
// dashes or parentheses, e.g. +910000000000. Country codes are 1-3 digits
// (USA is '1', India is '91', some countries run 3 digits), so total length
// after the '+' is checked as a range (8-15 digits), not a fixed count.
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

export type ParsedPhone = { phone: string | null } | { error: string };

export function parsePhone(raw: string | null | undefined): ParsedPhone {
	const value = (raw ?? '').trim();
	if (!value) {
		return { phone: null };
	}
	if (!PHONE_RE.test(value)) {
		return { error: 'Enter a phone number with country code, e.g. +910000000000' };
	}
	return { phone: value };
}
