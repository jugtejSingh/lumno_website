import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { therapistSettings } from '$lib/server/db/schema';
import {
	MAX_CLIENT_FIELD_HEADINGS,
	MAX_CLIENT_FIELD_LABEL_LENGTH,
	MAX_CLIENT_FIELD_VALUE_LENGTH,
	clientFieldInputName,
	type ClientFieldHeading,
	type ClientFieldValues
} from '$lib/types/clientFields';

export async function getClientFieldHeadings(therapistId: string): Promise<ClientFieldHeading[]> {
	const [row] = await db
		.select({ headings: therapistSettings.clientFieldHeadings })
		.from(therapistSettings)
		.where(eq(therapistSettings.therapistId, therapistId));
	// ponytail: row seeded at therapist creation (therapistProfile.ts), always present
	return row!.headings;
}

export async function updateClientFieldHeadings(
	therapistId: string,
	headings: ClientFieldHeading[],
	executor: DbOrTx = db
) {
	await executor
		.update(therapistSettings)
		.set({ clientFieldHeadings: headings })
		.where(eq(therapistSettings.therapistId, therapistId));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The settings form posts parallel `clientFieldHeadingId` / `clientFieldHeadingLabel`
// lists in display order. The page mints a UUID for each new heading itself, so the
// id it keeps on screen after saving is the one stored — a second save can't re-key
// the heading and orphan its values. Anything not UUID-shaped (or repeated) gets a
// fresh id. Blank labels are dropped. Ids only ever key this therapist's own clients'
// values, so a hand-picked id can at most resurface that therapist's own old notes.
export function parseClientFieldHeadings(
	ids: string[],
	labels: string[]
): { headings: ClientFieldHeading[] } | { error: string } {
	const seenIds = new Set<string>();
	const headings: ClientFieldHeading[] = [];
	const seenLabels = new Set<string>();
	for (let i = 0; i < labels.length; i++) {
		const label = labels[i].trim();
		if (!label) {
			continue;
		}
		if (label.length > MAX_CLIENT_FIELD_LABEL_LENGTH) {
			return { error: `Client field headings must be ${MAX_CLIENT_FIELD_LABEL_LENGTH} characters or fewer` };
		}
		const key = label.toLowerCase();
		if (seenLabels.has(key)) {
			return { error: `The client field heading "${label}" is listed twice` };
		}
		seenLabels.add(key);

		let id = (ids[i] ?? '').toLowerCase();
		if (!UUID_RE.test(id) || seenIds.has(id)) {
			id = randomUUID();
		}
		seenIds.add(id);
		headings.push({ id, label });
	}

	if (headings.length > MAX_CLIENT_FIELD_HEADINGS) {
		return { error: `You can have at most ${MAX_CLIENT_FIELD_HEADINGS} client field headings` };
	}
	return { headings };
}

// Applies the submitted values for the therapist's current headings on top of what the
// client already has. Values under headings that were since deleted are carried over
// untouched, so deleting a heading hides its notes rather than destroying them.
export function mergeClientFieldValues(
	existing: ClientFieldValues,
	headings: ClientFieldHeading[],
	form: FormData
): ClientFieldValues {
	const merged: ClientFieldValues = { ...existing };
	for (const heading of headings) {
		const raw = form.get(clientFieldInputName(heading.id))?.toString() ?? '';
		const value = raw.trim().slice(0, MAX_CLIENT_FIELD_VALUE_LENGTH);
		if (value) {
			merged[heading.id] = value;
		} else {
			delete merged[heading.id];
		}
	}
	return merged;
}
