// Phone numbers are client-supplied and unverified — we only check the shape so a
// stored number is plausibly dialable. Country code optional; WhatsApp will need a
// canonical E.164 form later, which is when real parsing (and verification) lands.
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

export type ParsedPhone = { phone: string | null } | { error: string };

export function parsePhone(raw: string | null | undefined): ParsedPhone {
	const value = (raw ?? '').trim();
	if (!value) {
		return { phone: null };
	}
	if (!PHONE_RE.test(value)) {
		return { error: 'Enter a phone number with 7–20 digits, e.g. +91 98765 43210' };
	}
	return { phone: value };
}
