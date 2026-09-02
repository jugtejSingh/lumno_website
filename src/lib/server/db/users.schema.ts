import { relations } from 'drizzle-orm';
import { pgTable, text, integer, date, timestamp, index, pgEnum, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { user } from './auth.schema';
import { organization } from './organizations.schema';

export const clientStatusEnum = pgEnum('client_status', ['active', 'paused', 'left']);

export const therapist = pgTable('therapist', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	dateOfBirth: date('date_of_birth'),
	bio: text('bio'),
	tags: text('tags').array().notNull().default([]),
	photoUrl: text('photo_url'),
	slug: text('slug').notNull().unique(),
	location: text('location'),
	// ISO 4217 code; interchangeable per therapist, defaults to India
	currency: text('currency').notNull().default('INR'),
	// IANA zone name; anchors booking-rule times (see therapist_settings), not display
	timezone: text('timezone').notNull().default('Asia/Kolkata'),
	// at most one org per therapist; null = solo. onDelete set null so deleting an
	// org just detaches its members rather than cascading their profiles away.
	organizationId: text('organization_id').references((): AnyPgColumn => organization.id, {
		onDelete: 'set null'
	}),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const client = pgTable(
	'client',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		// set once the client accepts this therapist's invite; null until then.
		// not unique — the same person can be a client of multiple therapists.
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		email: text('email'),
		age: integer('age'),
		bio: text('bio'),
		tags: text('tags').array().notNull().default([]),
		// per-session rate in whole units of the therapist's currency (see therapist.currency)
		rate: integer('rate'),
		status: clientStatusEnum('status').notNull().default('active'),
		// invite link sent to the client's email; cleared once they accept
		inviteToken: text('invite_token').unique(),
		inviteExpiresAt: timestamp('invite_expires_at'),
		// set/cleared by syncClientActivationForCap (billing.ts) as the therapist's
		// plan cap changes. While set: not bookable, not counted against the cap.
		deactivatedAt: timestamp('deactivated_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('client_therapistId_idx').on(table.therapistId)]
);

export const therapistRelations = relations(therapist, ({ one, many }) => ({
	user: one(user, { fields: [therapist.userId], references: [user.id] }),
	clients: many(client),
	organization: one(organization, {
		fields: [therapist.organizationId],
		references: [organization.id],
		relationName: 'organization_members'
	})
}));

export const clientRelations = relations(client, ({ one }) => ({
	therapist: one(therapist, { fields: [client.therapistId], references: [therapist.id] }),
	user: one(user, { fields: [client.userId], references: [user.id] })
}));