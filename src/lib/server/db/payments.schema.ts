import { relations, sql } from 'drizzle-orm';
import { pgTable, text, integer, boolean, timestamp, uniqueIndex, index, pgEnum, check } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { therapist, client } from './users.schema';
import { appointment } from './appointments.schema';

export const packExhaustedActionEnum = pgEnum('pack_exhausted_action', [
	'block_booking',
	'require_single_payment'
]);
export const packStatusEnum = pgEnum('pack_status', ['pending_payment', 'active', 'completed', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'paid']);
// how a therapist collects session payments:
//   'manual'    — client pays off-platform, therapist ticks the row paid (today's default)
//   'automatic' — client pays inside the portal via Razorpay Route; the webhook ticks it
// 'automatic' only takes effect when therapist.razorpayAccountId is set and currency is INR.
export const paymentModeEnum = pgEnum('payment_mode', ['manual', 'automatic']);
// how a specific payment row was settled — 'manual' until a Razorpay capture flips it
export const paidViaEnum = pgEnum('paid_via', ['manual', 'razorpay']);

export const paymentSettings = pgTable('payment_settings', {
	therapistId: text('therapist_id')
		.primaryKey()
		.references(() => therapist.id, { onDelete: 'cascade' }),
	packsEnabled: boolean('packs_enabled').notNull().default(false),
	paymentMode: paymentModeEnum('payment_mode').notNull().default('manual'),
	// what happens once a client's pack hits 0 remaining credits
	packExhaustedAction: packExhaustedActionEnum('pack_exhausted_action')
		.notNull()
		.default('require_single_payment'),
	// hours of notice before a session's start_at required to cancel/reschedule for free
	freeChangeWindowHours: integer('free_change_window_hours').notNull().default(24),
	// hours of notice for the 50% tier; null = no partial tier, straight from free to 100%
	partialChangeWindowHours: integer('partial_change_window_hours').default(8)
});

export const paymentPack = pgTable(
	'payment_pack',
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
		sessionCount: integer('session_count').notNull(),
		// total price, whole units of the therapist's currency
		amount: integer('amount').notNull(),
		status: packStatusEnum('status').notNull().default('pending_payment'),
		paidAt: timestamp('paid_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('paymentPack_clientId_idx').on(table.clientId),
		// a client can have at most one active pack at a time
		uniqueIndex('paymentPack_clientId_active_idx')
			.on(table.clientId)
			.where(sql`${table.status} = 'active'`)
	]
);

export const payment = pgTable(
	'payment',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		// exactly one of clientId/customName is set — see the check constraint below
		clientId: text('client_id').references(() => client.id, { onDelete: 'cascade' }),
		// set instead of clientId for a one-off charge under a free-text name;
		// no client row is created for those
		customName: text('custom_name'),
		// nullable: a therapist can add an ad-hoc charge not tied to a booking.
		// not unique: an appointment can carry more than one payment row
		// (e.g. the base session fee plus a separate late-fee row)
		appointmentId: text('appointment_id').references(() => appointment.id, { onDelete: 'set null' }),
		// defaults to client.rate at creation time; therapist can edit any time
		amount: integer('amount').notNull(),
		// free text context for the amount, e.g. "late cancellation fee (50%)"
		note: text('note'),
		status: paymentStatusEnum('status').notNull().default('unpaid'),
		// set when portal checkout starts; the webhook looks the row up by this.
		// unique so a retried checkout can't attach a second order to the same row.
		razorpayOrderId: text('razorpay_order_id').unique(),
		// the captured payment id from Razorpay — reconciliation / dashboard lookups
		razorpayPaymentId: text('razorpay_payment_id'),
		paidVia: paidViaEnum('paid_via').notNull().default('manual'),
		paidAt: timestamp('paid_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('payment_clientId_idx').on(table.clientId),
		index('payment_appointmentId_idx').on(table.appointmentId),
		check(
			'payment_client_xor_customName',
			sql`(${table.clientId} is not null)::int + (${table.customName} is not null)::int = 1`
		)
	]
);

export const paymentSettingsRelations = relations(paymentSettings, ({ one }) => ({
	therapist: one(therapist, { fields: [paymentSettings.therapistId], references: [therapist.id] })
}));

export const paymentPackRelations = relations(paymentPack, ({ one, many }) => ({
	therapist: one(therapist, { fields: [paymentPack.therapistId], references: [therapist.id] }),
	client: one(client, { fields: [paymentPack.clientId], references: [client.id] }),
	appointments: many(appointment)
}));

export const paymentRelations = relations(payment, ({ one }) => ({
	therapist: one(therapist, { fields: [payment.therapistId], references: [therapist.id] }),
	client: one(client, { fields: [payment.clientId], references: [client.id] }),
	appointment: one(appointment, { fields: [payment.appointmentId], references: [appointment.id] })
}));