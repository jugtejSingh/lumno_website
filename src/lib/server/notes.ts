import { and, desc, eq } from 'drizzle-orm';
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
				visibility: clientNote.visibility,
				body: clientNote.body,
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
	appointmentId: string | null
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
		.values({ therapistId, clientId, visibility, body, appointmentId })
		.returning();
	return { note: row };
}

// Read-only for the portal: shared notes only, oldest last (matches the therapist-side ordering).
export async function listSharedNotesForClient(clientId: string) {
	return db
		.select({ body: clientNote.body, createdAt: clientNote.createdAt })
		.from(clientNote)
		.where(and(eq(clientNote.clientId, clientId), eq(clientNote.visibility, 'shared')))
		.orderBy(desc(clientNote.createdAt));
}