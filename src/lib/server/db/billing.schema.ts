import { relations, sql } from 'drizzle-orm';
import { pgTable, text, integer, boolean, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { therapist } from './users.schema';
import { organization } from './organizations.schema';

// One row per holder (therapist for now — organizations are disabled, see
// organizations.ts), created lazily on first touch. Free = plan 0, status
// 'active'; effective_tier-equivalent logic lives in billing.ts. Modelled
// directly on edvion's `subscriptions` table.
export const subscription = pgTable(
	'subscription',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		therapistId: text('therapist_id').references(() => therapist.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => organization.id, { onDelete: 'cascade' }),
		// tier number (1..3); seat cap per tier is hard-coded in billing.ts
		plan: integer('plan').notNull().default(0),
		// 'active' | 'past_due' | 'cancelled' — the access gate. Plain string, not an
		// enum: halted and pending both collapse to 'past_due' in the webhook handler,
		// there's no behavioral difference between them worth a separate state.
		status: text('status').notNull().default('active'),
		razorpaySubscriptionId: text('razorpay_subscription_id').unique(),
		razorpayCustomerId: text('razorpay_customer_id'),
		// exact plan_id of the live sub, for "same plan" detection in the plan-change flow
		razorpayPlanId: text('razorpay_plan_id'),
		// end of the current paid cycle. Display + missed-webhook backstop only —
		// `status` is the real gate.
		currentEnd: timestamp('current_end'),
		// in-flight sub the holder is checking out right now, or the "__creating__"
		// sentinel while our own subscriptions.create() call is in flight. Cleared by
		// the webhook once the first charge lands. See razorpay.ts.
		pendingSubId: text('pending_sub_id'),
		pendingPlanId: text('pending_plan_id'),
		pendingSince: timestamp('pending_since'),
		// user clicked Cancel: Razorpay cancels at cycle end, status stays 'active'
		// until the terminal webhook. Cleared when that webhook lands.
		cancelScheduled: boolean('cancel_scheduled'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('subscription_therapistId_uidx').on(table.therapistId),
		uniqueIndex('subscription_organizationId_uidx').on(table.organizationId),
		check(
			'subscription_one_holder',
			sql`(${table.therapistId} is not null)::int + (${table.organizationId} is not null)::int = 1`
		)
	]
);

export const subscriptionRelations = relations(subscription, ({ one }) => ({
	therapist: one(therapist, { fields: [subscription.therapistId], references: [therapist.id] }),
	organization: one(organization, {
		fields: [subscription.organizationId],
		references: [organization.id]
	})
}));

// Append-only log of every processed webhook. `signature` is unique — the
// inbound idempotency key (layer 1 of the webhook handler): INSERT ... ON
// CONFLICT (signature) DO NOTHING, no row back = dup, skip dispatch. The rest
// is audit only. Grows unbounded — no retention job (deferred, same as edvion).
// Modelled directly on edvion's `razorpay_events` table.
export const razorpayEvent = pgTable(
	'razorpay_event',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		signature: text('signature').notNull(),
		therapistId: text('therapist_id'),
		plan: integer('plan'),
		razorpayPlanId: text('razorpay_plan_id'),
		razorpaySubscriptionId: text('razorpay_subscription_id'),
		razorpayCustomerId: text('razorpay_customer_id'),
		razorpayPaymentId: text('razorpay_payment_id'),
		amount: integer('amount'),
		currency: text('currency'),
		event: text('event'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [uniqueIndex('razorpay_event_signature_uidx').on(table.signature)]
);
