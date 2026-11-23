import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import type { IntakeAnswers, IntakeQuestion } from '../../types/intake';
import { therapist, client } from './users.schema';

// A therapist's intake form. Responses point at `id`, which never changes; the share token
// is only how the public link finds the form, and can be regenerated or turned off.
// ponytail: unique therapistId = one form per therapist. Drop the unique constraint when
// multiple forms are built (see docs/intake_form.md "Future: multiple forms").
export const intakeForm = pgTable('intake_form', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	therapistId: text('therapist_id')
		.notNull()
		.unique()
		.references(() => therapist.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	// shown above the questions on the public form
	intro: text('intro'),
	questions: jsonb('questions').$type<IntakeQuestion[]>().notNull().default([]),
	// null = link off. No expiry: permanent until regenerated or turned off
	shareToken: text('share_token').unique(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const intakeResponse = pgTable(
	'intake_response',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		// the form this answers; stays connected when the share link is regenerated
		intakeFormId: text('intake_form_id')
			.notNull()
			.references(() => intakeForm.id, { onDelete: 'cascade' }),
		// the questions as they were when answered, so editing the form never changes old responses
		questionsSnapshot: jsonb('questions_snapshot').$type<IntakeQuestion[]>().notNull(),
		answers: jsonb('answers').$type<IntakeAnswers>().notNull(),
		// copied out of the email / name questions, for the list and for import
		email: text('email'),
		name: text('name'),
		// set once imported as a client
		clientId: text('client_id').references(() => client.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('intake_response_therapist_id_created_at_idx').on(table.therapistId, table.createdAt),
		index('intake_response_form_id_idx').on(table.intakeFormId),
		index('intake_response_client_id_idx').on(table.clientId)
	]
);
