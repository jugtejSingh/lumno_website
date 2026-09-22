import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment, client, clientNote } from '$lib/server/db/schema';

export type NoteVisibility = 'private' | 'shared';

function formatSessionLabel(startAt: Date, timezone: string) {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(startAt);
}

export async function listClientsWithNotes(therapistId: string, therapistTimezone: string) {
	const [clients, notes] = await Promise.all([
		db.select({ id: client.id, name: client.name }).from(client).where(eq(client.therapistId, therapistId)),
		db
			.select({
				id: clientNote.id,
				clientId: clientNote.clientId,
				appointmentId: clientNote.appointmentId,
				visibility: clientNote.visibility,
				body: clientNote.body,
				description: clientNote.description,
				createdAt: clientNote.createdAt,
				sessionAt: appointment.startAt
			})
			.from(clientNote)
			.leftJoin(appointment, eq(clientNote.appointmentId, appointment.id))
			.where(eq(clientNote.therapistId, therapistId))
			.orderBy(desc(clientNote.createdAt))
	]);

	const withLabel = notes.map((n) => ({
		...n,
		sessionLabel: n.sessionAt ? formatSessionLabel(n.sessionAt, therapistTimezone) : null
	}));

	return clients.map((c) => ({
		id: c.id,
		name: c.name,
		notes: withLabel.filter((n) => n.clientId === c.id && n.visibility === 'private'),
		sharedNotes: withLabel.filter((n) => n.clientId === c.id && n.visibility === 'shared')
	}));
}

export async function createNote(
	therapistId: string,
	clientId: string,
	visibility: NoteVisibility,
	body: string,
	appointmentId: string | null,
	description: string | null
) {
	const [clientRow] = await db
		.select({ id: client.id })
		.from(client)
		.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
	if (!clientRow) {
		return { error: 'not_found' as const };
	}

	if (appointmentId) {
		const [apptRow] = await db
			.select({ id: appointment.id })
			.from(appointment)
			.where(and(eq(appointment.id, appointmentId), eq(appointment.clientId, clientId)));
		if (!apptRow) {
			return { error: 'not_found' as const };
		}
	}

	const [row] = await db
		.insert(clientNote)
		.values({ therapistId, clientId, visibility, body, appointmentId, description })
		.returning();
	return { note: row };
}

export async function updateNote(
	therapistId: string,
	noteId: string,
	body: string,
	appointmentId: string | null,
	description: string | null
) {
	const [noteRow] = await db
		.select({ id: clientNote.id, clientId: clientNote.clientId })
		.from(clientNote)
		.where(and(eq(clientNote.id, noteId), eq(clientNote.therapistId, therapistId)));
	if (!noteRow) {
		return { error: 'not_found' as const };
	}

	if (appointmentId) {
		const [apptRow] = await db
			.select({ id: appointment.id })
			.from(appointment)
			.where(and(eq(appointment.id, appointmentId), eq(appointment.clientId, noteRow.clientId)));
		if (!apptRow) {
			return { error: 'not_found' as const };
		}
	}

	const [row] = await db
		.update(clientNote)
		.set({ body, appointmentId, description })
		.where(eq(clientNote.id, noteId))
		.returning();
	return { note: row };
}

const NOTES_CONTEXT_WORD_LIMIT = 5000;

// Newest-first private notes for one client, concatenated and capped at ~5000 words
// so the chat prompt stays a fixed size regardless of how much history a client has.
export async function privateNotesContext(therapistId: string, clientId: string): Promise<string> {
	const rows = await db
		.select({ body: clientNote.body, createdAt: clientNote.createdAt })
		.from(clientNote)
		.where(
			and(eq(clientNote.therapistId, therapistId), eq(clientNote.clientId, clientId), eq(clientNote.visibility, 'private'))
		)
		.orderBy(desc(clientNote.createdAt));

	const parts: string[] = [];
	let wordCount = 0;
	for (const row of rows) {
		const dateLabel = row.createdAt.toISOString().slice(0, 10);
		const entry = `[${dateLabel}]\n${row.body}`;
		const entryWords = entry.split(/\s+/).filter(Boolean).length;
		if (wordCount + entryWords > NOTES_CONTEXT_WORD_LIMIT) {
			break;
		}
		parts.push(entry);
		wordCount += entryWords;
	}
	return parts.join('\n\n');
}

// Read-only for the portal: shared notes only, oldest last (matches the therapist-side ordering).
export async function listSharedNotesForClient(
	clientId: string,
	page: number,
	pageSize: number
): Promise<{ rows: Array<{ body: string; createdAt: Date }>; total: number }> {
	const where = and(eq(clientNote.clientId, clientId), eq(clientNote.visibility, 'shared'));

	const [rows, [countRow]] = await Promise.all([
		db
			.select({ body: clientNote.body, createdAt: clientNote.createdAt })
			.from(clientNote)
			.where(where)
			.orderBy(desc(clientNote.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db.select({ count: sql<number>`count(*)::int` }).from(clientNote).where(where)
	]);

	return { rows, total: countRow?.count ?? 0 };
}