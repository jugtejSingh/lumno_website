import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { therapist } from './users.schema';

// A practice that groups therapists. The owner is one of its therapists and acts
// as admin for everyone in the org (manages members, and later the shared plan).
// Membership itself is therapist.organizationId — no separate join table.
export const organization = pgTable('organization', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	name: text('name').notNull(),
	ownerTherapistId: text('owner_therapist_id')
		.notNull()
		.references(() => therapist.id, { onDelete: 'restrict' }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const organizationRelations = relations(organization, ({ one, many }) => ({
	owner: one(therapist, {
		fields: [organization.ownerTherapistId],
		references: [therapist.id],
		relationName: 'organization_owner'
	}),
	members: many(therapist, { relationName: 'organization_members' })
}));
