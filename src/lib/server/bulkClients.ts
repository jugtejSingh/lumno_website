import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { aiUsage } from '$lib/server/db/schema';
import { usageLimit, getEffectivePlan } from '$lib/server/billing';
import { aiAccessBlock, currentYearMonth, extractClients } from '$lib/server/ai';
import { addClient, listClients } from '$lib/server/clients';
import { bulkExtractRatelimit } from '$lib/server/rateLimit';
import {
	BULK_MAX_ROWS,
	BULK_MAX_TEXT_LENGTH,
	flagRows,
	type BulkAddOutcome,
	type BulkAddRowResult,
	type BulkRow,
	type FlaggedBulkRow
} from '$lib/bulkClientRows';

// null limit = unlimited
export type BulkImportAllowance = { used: number; limit: number | null };

export async function getBulkImportAllowance(therapistId: string): Promise<BulkImportAllowance> {
	const limit = await usageLimit(therapistId, 'bulkImportsPerMonth');
	const [row] = await db
		.select({ bulkImports: aiUsage.bulkImports })
		.from(aiUsage)
		.where(and(eq(aiUsage.therapistId, therapistId), eq(aiUsage.yearMonth, currentYearMonth())));
	let used = 0;
	if (row) {
		used = row.bulkImports;
	}
	// a plan without the key isn't allowed imports (same rule as usageLimit everywhere else);
	// Infinity becomes null because it doesn't survive serialisation to the page
	let shownLimit: number | null;
	if (limit === null) {
		shownLimit = 0;
	} else if (Number.isFinite(limit)) {
		shownLimit = limit;
	} else {
		shownLimit = null;
	}
	return { used, limit: shownLimit };
}

async function recordBulkImport(therapistId: string) {
	await db
		.insert(aiUsage)
		.values({ therapistId, yearMonth: currentYearMonth(), bulkImports: 1 })
		.onConflictDoUpdate({
			target: [aiUsage.therapistId, aiUsage.yearMonth],
			set: { bulkImports: sql`${aiUsage.bulkImports} + 1` }
		});
}

export type ExtractResult =
	| { rows: FlaggedBulkRow[]; truncated: boolean }
	| { error: string; status: 400 | 403 | 429 | 502 };

// The AI step. Saves no clients — only returns a flagged draft for the therapist to review.
export async function extractBulkClients(therapistId: string, text: string): Promise<ExtractResult> {
	const trimmed = text.trim();
	if (!trimmed) {
		return { error: 'Paste your client list first.', status: 400 };
	}
	if (trimmed.length > BULK_MAX_TEXT_LENGTH) {
		return {
			error: `That's too much text at once — split it into chunks under ${BULK_MAX_TEXT_LENGTH.toLocaleString()} characters.`,
			status: 400
		};
	}

	// Free has no AI token budget, so it isn't run through aiAccessBlock — its monthly import
	// count below is the whole limit. Paid plans also stop at their AI token cap.
	const { tier } = await getEffectivePlan(therapistId);
	if (tier !== 0) {
		const block = await aiAccessBlock(therapistId);
		if (block) {
			return { error: block.message, status: block.status };
		}
	}

	const allowance = await getBulkImportAllowance(therapistId);
	// ponytail: check-then-increment, so two imports fired at the same instant can both pass
	// the last free slot. The rate limit bounds it; use a conditional upsert if it matters.
	if (allowance.limit !== null && allowance.used >= allowance.limit) {
		return {
			error: `You've used all ${allowance.limit} bulk imports for this month. They reset next month — or add clients one by one.`,
			status: 429
		};
	}

	const { success } = await bulkExtractRatelimit.limit(therapistId);
	if (!success) {
		return { error: 'Too many imports in a short time. Please try again in a bit.', status: 429 };
	}

	const extracted = await extractClients(therapistId, trimmed);
	if (extracted === null) {
		return { error: "Couldn't read that list right now. Please try again.", status: 502 };
	}
	// only a successful read uses up an import
	await recordBulkImport(therapistId);

	let truncated = false;
	let rows = extracted;
	if (rows.length > BULK_MAX_ROWS) {
		rows = rows.slice(0, BULK_MAX_ROWS);
		truncated = true;
	}

	return { rows: flagRows(rows, await existingEmailSet(therapistId)), truncated };
}

async function existingEmailSet(therapistId: string): Promise<Set<string>> {
	const emails = new Set<string>();
	for (const row of await listClients(therapistId)) {
		if (row.email) {
			emails.add(row.email.toLowerCase());
		}
	}
	return emails;
}

// Saves the reviewed rows one by one through addClient, so the plan cap, duplicate and self
// checks, and the invite email all behave exactly like a single add. Rows past the active
// cap are saved inactive (allowInactive); once the inactive limit is hit the rest are left.
export async function bulkAddClients(
	therapistId: string,
	rows: BulkRow[],
	origin: string
): Promise<BulkAddRowResult[]> {
	const checked = flagRows(rows.slice(0, BULK_MAX_ROWS), await existingEmailSet(therapistId));
	const results: BulkAddRowResult[] = [];
	let limitHit = false;

	for (const row of checked) {
		if (row.flags.length > 0) {
			let outcome: BulkAddOutcome = 'skipped_invalid';
			if (row.flags.includes('existing_client') || row.flags.includes('duplicate_in_list')) {
				outcome = 'skipped_duplicate';
			}
			results.push({ name: row.name, email: row.email, outcome });
			continue;
		}
		if (limitHit) {
			results.push({ name: row.name, email: row.email, outcome: 'not_added_limit' });
			continue;
		}

		const result = await addClient(
			therapistId,
			{ name: row.name, email: row.email, customFields: {}, rate: row.rate },
			origin,
			{ allowInactive: true }
		);

		if (!('client' in result) || result.client === undefined) {
			if (result.error === 'limit_reached' || result.error === 'inactive_limit_reached') {
				limitHit = true;
				results.push({ name: row.name, email: row.email, outcome: 'not_added_limit' });
			} else if (result.error === 'self') {
				results.push({ name: row.name, email: row.email, outcome: 'skipped_self' });
			} else {
				// duplicate: another tab added them since the check above
				results.push({ name: row.name, email: row.email, outcome: 'skipped_duplicate' });
			}
			continue;
		}

		let outcome: BulkAddOutcome = 'added';
		if (result.client.deactivatedAt !== null) {
			outcome = 'added_inactive';
		}
		const rowResult: BulkAddRowResult = { name: row.name, email: row.email, outcome };
		if (!result.emailSent) {
			rowResult.inviteUrl = result.inviteUrl;
		}
		results.push(rowResult);
	}

	return results;
}
