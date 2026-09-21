import { relations, sql } from 'drizzle-orm';
import { pgTable, text, timestamp, integer, index, pgEnum, check } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { RESOURCE_TAGS } from '../../types/resources';
import { therapist, client } from './users.schema';

export const clientResourceKindEnum = pgEnum('client_resource_kind', ['file', 'link']);

export const clientResourceTagEnum = pgEnum('client_resource_tag', RESOURCE_TAGS);

export const clientResourceUploaderEnum = pgEnum('client_resource_uploader', ['therapist', 'client']);

// Documents and links shared between a therapist and one client. Both sides see
// every row; only the uploader can delete their own.
export const clientResource = pgTable(
	'client_resource',
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
		kind: clientResourceKindEnum('kind').notNull(),
		name: text('name').notNull(),
		tag: clientResourceTagEnum('tag').notNull(),
		// file only: resources/{therapistId}/{clientId}/{uuid}, always server-generated.
		// unique so one uploaded object can never be registered twice.
		s3Key: text('s3_key').unique(),
		contentType: text('content_type'),
		sizeBytes: integer('size_bytes'),
		// link only: http(s) URL
		url: text('url'),
		uploadedBy: clientResourceUploaderEnum('uploaded_by').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('clientResource_clientId_createdAt_idx').on(table.clientId, table.createdAt),
		check(
			'client_resource_kind_payload',
			sql`(${table.kind} = 'file' AND ${table.s3Key} IS NOT NULL AND ${table.url} IS NULL)
				OR (${table.kind} = 'link' AND ${table.url} IS NOT NULL AND ${table.s3Key} IS NULL)`
		)
	]
);

export const clientResourceRelations = relations(clientResource, ({ one }) => ({
	therapist: one(therapist, { fields: [clientResource.therapistId], references: [therapist.id] }),
	client: one(client, { fields: [clientResource.clientId], references: [client.id] })
}));
