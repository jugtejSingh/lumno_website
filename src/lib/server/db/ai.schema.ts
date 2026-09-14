import { pgTable, text, integer, primaryKey } from 'drizzle-orm/pg-core';
import { therapist } from './users.schema';

// One row per therapist per calendar month ('2026-09'); the cap check just
// reads/upserts the current month's row, so usage resets on its own with no
// cleanup job.
export const aiUsage = pgTable(
	'ai_usage',
	{
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		yearMonth: text('year_month').notNull(),
		tokensUsed: integer('tokens_used').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.therapistId, table.yearMonth] })]
);