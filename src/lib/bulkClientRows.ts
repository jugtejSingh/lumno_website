import { isValidEmail } from '$lib/isValidEmail';

// Shared by the bulk-add dialog (live flags while the therapist edits) and the
// bulkAdd action (which re-checks everything — the browser's flags are never trusted).

export const BULK_MAX_TEXT_LENGTH = 20_000;
export const BULK_MAX_ROWS = 200;

// rate: price per session in whole units of the therapist's currency (same as client.rate)
export type BulkRow = { name: string; email: string; rate: number };

// What the AI returns: rate is null when the text had no usable price for that person,
// and the dialog then fills in the base price the therapist typed.
export type ExtractedBulkRow = { name: string; email: string; rate: number | null };

// client.rate is a Postgres integer; a bigger value would fail the insert halfway through a bulk add
const MAX_RATE = 2_147_483_647;

// A whole number from 0 to MAX_RATE, or null for anything else (missing, "abc", -5, 60.5).
export function parseRate(value: unknown): number | null {
	if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_RATE) {
		return value;
	}
	return null;
}

export type BulkRowFlag = 'invalid_email' | 'missing_last_name' | 'duplicate_in_list' | 'existing_client';

export type FlaggedBulkRow = ExtractedBulkRow & { flags: BulkRowFlag[] };

export const BULK_FLAG_LABELS: Record<BulkRowFlag, string> = {
	invalid_email: 'Email looks wrong',
	missing_last_name: 'Needs first and last name',
	duplicate_in_list: 'Listed twice',
	existing_client: 'Already a client'
};

export type BulkAddOutcome =
	| 'added'
	| 'added_inactive'
	| 'skipped_invalid'
	| 'skipped_duplicate'
	| 'skipped_self'
	| 'not_added_limit';

export type BulkAddRowResult = {
	name: string;
	email: string;
	outcome: BulkAddOutcome;
	// set when the client was saved but the invite email couldn't be sent
	inviteUrl?: string;
};

// existingEmails must already be lower-cased. Any other fields on a row (e.g. rate) are kept as-is.
export function flagRows<T extends { name: string; email: string }>(
	rows: T[],
	existingEmails: Set<string>
): (T & { flags: BulkRowFlag[] })[] {
	const seen = new Set<string>();
	const flagged: (T & { flags: BulkRowFlag[] })[] = [];

	for (const row of rows) {
		const name = row.name.trim();
		const email = row.email.trim();
		const emailKey = email.toLowerCase();
		const flags: BulkRowFlag[] = [];

		if (!isValidEmail(email)) {
			flags.push('invalid_email');
		}
		// same rule as the single "add client" action
		if (!name.includes(' ')) {
			flags.push('missing_last_name');
		}
		if (emailKey) {
			if (existingEmails.has(emailKey)) {
				flags.push('existing_client');
			} else if (seen.has(emailKey)) {
				// only the second and later copies are flagged, so the first one can still be added
				flags.push('duplicate_in_list');
			}
			seen.add(emailKey);
		}

		flagged.push({ ...row, name, email, flags });
	}

	return flagged;
}
