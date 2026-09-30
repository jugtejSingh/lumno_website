// Shape check only (something@something.tld, no spaces). Whether the address really works is
// only known when a message to it is delivered.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
	return EMAIL_PATTERN.test(value);
}
