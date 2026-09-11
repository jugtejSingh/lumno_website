import { relations, sql } from 'drizzle-orm';
import {
	pgTable,
	text,
	integer,
	boolean,
	timestamp,
	uniqueIndex,
	index,
	pgEnum,
	check
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { therapist, client } from './users.schema';
import { appointment } from './appointments.schema';

export const packExhaustedActionEnum = pgEnum('pack_exhausted_action', [
	'block_booking',
	'require_single_payment'
]);
export const packStatusEnum = pgEnum('pack_status', [
	'pending_payment',
	'active',
	'completed',
	'cancelled'
]);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'paid']);
// how a therapist collects session payments:
//   'manual'    — client pays off-platform, therapist ticks the row paid (today's default)
//   'automatic' — client pays inside the portal via Razorpay partner OAuth; the webhook ticks it
// 'automatic' only takes effect when therapistRazorpayConnection.status is 'active' and currency is INR.
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
	partialChangeWindowHours: integer('partial_change_window_hours').default(8),
	// manual-mode payment details shown to clients in the portal when they can't
	// pay through Razorpay: S3 object key of an uploaded QR image, and free-text
	// bank/UPI details. Both null until the therapist sets them.
	payQrKey: text('pay_qr_key'),
	payBankDetails: text('pay_bank_details')
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
		appointmentId: text('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),
		// defaults to client.rate at creation time; therapist can edit any time
		amount: integer('amount').notNull(),
		// free text context for the amount, e.g. "late cancellation fee (50%)"
		note: text('note'),
		status: paymentStatusEnum('status').notNull().default('unpaid'),
		// set when portal checkout starts; the webhook looks the row up by this.
		// unique so a retried checkout can't attach a second order to the same row.
		razorpayOrderId: text('razorpay_order_id').unique(),
		// when the order was attached — the sweep ages orders from this, not from
		// createdAt (the row is created at booking, the order maybe days later).
		razorpayOrderCreatedAt: timestamp('razorpay_order_created_at'),
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

// One row per therapist that has connected their own Razorpay merchant account
// via partner OAuth. Source of truth for "is this therapist able to take portal
// payments" — there is no therapist.razorpayAccountId column.
// See docs/razorpay-oauth-system-design.md §12.2.
export const razorpayConnectionStatusEnum = pgEnum('razorpay_connection_status', [
	'active', // tokens good
	'refresh_failed', // 4xx on refresh — therapist must re-consent
	'revoked' // authorization_revoked webhook, or therapist disconnected
]);

export const therapistRazorpayConnection = pgTable('therapist_razorpay_connection', {
	therapistId: text('therapist_id')
		.primaryKey()
		.references(() => therapist.id, { onDelete: 'cascade' }),
	razorpayAccountId: text('razorpay_account_id').notNull(), // acc_… — historic-order anchor
	mode: text('mode').notNull(), // 'test' | 'live'

	// AES-256-GCM; format "<iv b64>.<tag b64>.<ciphertext b64>" (tokenCrypto.ts).
	// Never plaintext at rest.
	accessTokenEnc: text('access_token_enc').notNull(),
	refreshTokenEnc: text('refresh_token_enc').notNull(),
	publicToken: text('public_token').notNull(), // not secret — goes to Checkout

	accessExpiresAt: timestamp('access_expires_at').notNull(),
	refreshExpiresAt: timestamp('refresh_expires_at').notNull(),

	status: razorpayConnectionStatusEnum('status').notNull().default('active'),
	refreshLockUntil: timestamp('refresh_lock_until'), // single-flight refresh guard
	refreshFailureCount: integer('refresh_failure_count').notNull().default(0),
	lastRefreshedAt: timestamp('last_refreshed_at'),
	reconnectEmailSentAt: timestamp('reconnect_email_sent_at'), // throttles the failure emails

	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

// Reconciliation exceptions (design doc §7). The daily cron sweep writes here
// when Razorpay's view of an order disagrees with ours — a human clears them by
// setting resolvedAt. No dashboard in v1; it's a `select ... where resolved_at
// is null` when someone asks.
export const razorpayReconcileExceptionKindEnum = pgEnum('razorpay_reconcile_exception_kind', [
	'amount_mismatch', // captured amount != payment.amount
	'unresolved_order' // order still unpaid on Razorpay's side well past checkout
]);

export const razorpayReconcileException = pgTable(
	'razorpay_reconcile_exception',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		paymentId: text('payment_id')
			.notNull()
			.references(() => payment.id, { onDelete: 'cascade' }),
		kind: razorpayReconcileExceptionKindEnum('kind').notNull(),
		detail: text('detail').notNull(),
		resolvedAt: timestamp('resolved_at'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		// one row per (payment, kind) — the sweep re-runs daily and must not pile up
		uniqueIndex('razorpay_reconcile_exception_payment_kind_uidx').on(table.paymentId, table.kind)
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
