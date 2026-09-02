import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { therapist, client } from './users.schema';
import { appointment } from './appointments.schema';

export const clientNoteVisibilityEnum = pgEnum('client_note_visibility', ['private', 'shared']);

export const clientNote = pgTable(
	'client_note',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		clientId: text('client_id')
			.notNull()
			.references(() => client.id, { onDelete: 'cascade' }),
		// optional link to the session this note is about
		appointmentId: text('appointment_id').references(() => appointment.id, { onDelete: 'set null' }),
		// private: therapist-only. shared: visible read-only to the client in their portal.
		visibility: clientNoteVisibilityEnum('visibility').notNull().default('private'),
		body: text('body').notNull(), // markdown source
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('clientNote_clientId_createdAt_idx').on(table.clientId, table.createdAt)]
);

export const clientNoteRelations = relations(clientNote, ({ one }) => ({
	therapist: one(therapist, { fields: [clientNote.therapistId], references: [therapist.id] }),
	client: one(client, { fields: [clientNote.clientId], references: [client.id] }),
	appointment: one(appointment, { fields: [clientNote.appointmentId], references: [appointment.id] })
}));