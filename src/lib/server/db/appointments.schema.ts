import { relations, sql } from 'drizzle-orm';
import {
	pgTable,
	text,
	timestamp,
	time,
	date,
	integer,
	primaryKey,
	foreignKey,
	boolean,
	index,
	pgEnum,
	check,
	jsonb,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import type { ClientFieldHeading } from '../../types/clientFields';
import { therapist, client } from './users.schema';
import { paymentPack } from './payments.schema';

// 'hybrid' means the client picks online/in_person at booking time (see appointmentModalityEnum)
export const slotModalityEnum = pgEnum('slot_modality', ['online', 'in_person', 'hybrid']);
export const appointmentModalityEnum = pgEnum('appointment_modality', ['online', 'in_person']);
export const appointmentStatusEnum = pgEnum('appointment_status', [
	'confirmed',
	'cancelled',
	'completed',
	'rescheduled'
]);

export const therapistSettings = pgTable('therapist_settings', {
	therapistId: text('therapist_id')
		.primaryKey()
		.references(() => therapist.id, { onDelete: 'cascade' }),
	// cap on a client's upcoming (not yet started, not cancelled) self-booked sessions; null = no limit.
	// Only portal bookings are checked — the therapist's own Calendar bookings are never capped.
	maxUpcomingBookingsPerClient: integer('max_upcoming_bookings_per_client'),
	// max sessions per day for each weekday of the slot template, index 0 = Sunday. A null
	// entry (or a null column) = no limit. Once a day holds that many sessions its slots are
	// hidden from clients; a date override carries its own cap instead (availabilityDateOverride).
	weeklyMaxSessions: integer('weekly_max_sessions').array().$type<(number | null)[]>(),
	// holiday flag for each weekday of the slot template, index 0 = Sunday. A holiday weekday
	// keeps its slots but can't be booked; a date override still wins. Null/missing = not a holiday.
	weeklyHolidays: boolean('weekly_holidays').array().$type<boolean[]>(),
	// blocks portal bookings while the client has any unpaid payment row (availability.ts)
	requireZeroBalance: boolean('require_zero_balance').notNull().default(false),
	// whether an online appointment gets a Google Meet link generated at booking/reschedule
	// time. Only meaningful once the therapist has connected Google (calendar.events scope on
	// their account row) — off just means "don't create a link", it doesn't disconnect anything
	sendMeetLinks: boolean('send_meet_links').notNull().default(true),
	// whether the booking-confirmed / cancelled / rescheduled client emails go out. Independent
	// of sendMeetLinks and of Google connection — unrelated to the always-on verification/invite mail
	sendBookingEmails: boolean('send_booking_emails').notNull().default(true),
	// whether the 24h/1h session reminder emails go out. Same on/off pattern as
	// sendBookingEmails, gates sendSessionReminders() in reminderEmails.ts
	sendSessionReminderEmails: boolean('send_session_reminder_emails').notNull().default(true),
	// whether the weekly payment-due reminder emails go out. Independent of the session
	// reminder toggle above — gates sendPaymentReminders() in reminderEmails.ts
	sendPaymentReminderEmails: boolean('send_payment_reminder_emails').notNull().default(true),
	// whether the rebook-nudge emails go out (4 days / 2 weeks / 1 month of no upcoming
	// session). See docs/rebook-reminders-plan.md.
	sendRebookReminderEmails: boolean('send_rebook_reminder_emails').notNull().default(true),
	// opted in to being listed on other therapists' Referrals page at all
	referralVisible: boolean('referral_visible').notNull().default(false),
	// sub-toggles: only meaningful while referralVisible is true. Enforced server-side
	// in listReferralTherapists, not just hidden in the UI.
	referralShowYears: boolean('referral_show_years').notNull().default(true),
	referralShowRate: boolean('referral_show_rate').notNull().default(true),
	// headings the therapist wants on every client profile (max 20, see clientFields.ts).
	// Values live in client.customFields keyed by heading id.
	clientFieldHeadings: jsonb('client_field_headings')
		.$type<ClientFieldHeading[]>()
		.notNull()
		.default([]),
	// free text the therapist writes on their Calendar page, shown read-only to clients
	// on the portal booking calendar (e.g. "payment is due before the session starts")
	bookingNote: text('booking_note')
});

// A date the therapist hand-edited. Its slots (availabilitySlot.overrideDate) fully replace
// that weekday's template; an override with no slots = day off.
export const availabilityDateOverride = pgTable(
	'availability_date_override',
	{
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		// the therapist's local calendar date
		date: date('date').notNull(),
		// this date's max sessions, replacing its weekday's cap; null = no limit
		maxSessions: integer('max_sessions')
	},
	// column order must match the database's (therapist_id, date). Any other order looks
	// "changed" to drizzle-kit push, which then tries to rebuild the key and fails, because
	// availabilitySlot_override_fk depends on it. The name is pinned for the same reason.
	(table) => [
		primaryKey({
			name: 'availability_date_override_therapist_id_date_pk',
			columns: [table.therapistId, table.date]
		})
	]
);

// A handcrafted bookable slot, in the therapist's local time. Belongs to either the weekly
// template (weekday) or one overridden date (overrideDate), never both.
export const availabilitySlot = pgTable(
	'availability_slot',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		// 0 = Sunday ... 6 = Saturday
		weekday: integer('weekday'),
		overrideDate: date('override_date'),
		startTime: time('start_time').notNull(),
		endTime: time('end_time').notNull(),
		modality: slotModalityEnum('modality').notNull(),
		// weekly-template slots only: the client this slot is held for every week. A nightly cron
		// books it ahead (recurringBookings.ts); null = an ordinary open slot
		reservedClientId: text('reserved_client_id').references(() => client.id, {
			onDelete: 'set null'
		})
	},
	(table) => [
		index('availabilitySlot_therapistId_idx').on(table.therapistId),
		// partial: the nightly cron only reads reserved slots, so it never scans the open ones
		index('availabilitySlot_reserved_idx')
			.on(table.reservedClientId)
			.where(sql`${table.reservedClientId} is not null`),
		// removing a date override takes its slots with it. Named explicitly: the auto-generated
		// name is over Postgres's 63-char limit, gets truncated, and drizzle-kit push then sees a
		// "changed" key on every push and fails trying to rebuild it.
		foreignKey({
			name: 'availabilitySlot_override_fk',
			columns: [table.therapistId, table.overrideDate],
			foreignColumns: [availabilityDateOverride.therapistId, availabilityDateOverride.date]
		}).onDelete('cascade'),
		check(
			'availabilitySlot_weekday_xor_overrideDate',
			sql`(${table.weekday} is not null)::int + (${table.overrideDate} is not null)::int = 1`
		),
		check('availabilitySlot_weekday_range', sql`${table.weekday} between 0 and 6`),
		check('availabilitySlot_end_after_start', sql`${table.endTime} > ${table.startTime}`),
		check(
			'availabilitySlot_reserved_template_only',
			sql`${table.reservedClientId} is null or ${table.weekday} is not null`
		)
	]
);

export const appointment = pgTable(
	'appointment',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		// null for a custom-name appointment (see customName) — no client row is created for those
		clientId: text('client_id').references(() => client.id, { onDelete: 'cascade' }),
		// set instead of clientId for a one-off booking under a free-text name, never both
		customName: text('custom_name'),
		// UTC instants; frontend converts for display
		startAt: timestamp('start_at', { withTimezone: true }).notNull(),
		endAt: timestamp('end_at', { withTimezone: true }).notNull(),
		modality: appointmentModalityEnum('modality').notNull(),
		status: appointmentStatusEnum('status').notNull().default('confirmed'),
		// reschedule never mutates a row: old row -> status 'rescheduled', new row points back here
		rescheduledFromId: text('rescheduled_from_id'),
		// set when this appointment was booked against a pack instead of paid individually.
		// on reschedule, this moves to the new row along with any payment rows (see payments.schema.ts)
		packId: text('pack_id').references((): AnyPgColumn => paymentPack.id, { onDelete: 'set null' }),
		// set only on a hold the cron or reserveSlot booked for a reserved weekly slot; null for
		// every portal/manual booking and for the new row of a reschedule. deleteFutureHolds
		// finds a slot's holds by this. set null so past/cancelled holds outlive the slot.
		slotId: text('slot_id').references(() => availabilitySlot.id, { onDelete: 'set null' }),
		notes: text('notes'),
		// set for online appointments when the therapist has a connected Google account;
		// null otherwise (no Meet link shown)
		meetLink: text('meet_link'),
		// Google Calendar event id backing meetLink — needed to patch/delete the event on
		// reschedule/cancel, since Google's API keys off the event id, not the link
		googleEventId: text('google_event_id'),
		// set once the 24h/1h-before reminder email has gone out; null means not sent yet.
		// prevents resending on every cron tick that finds the appointment still in the window
		reminder24hSentAt: timestamp('reminder_24h_sent_at', { withTimezone: true }),
		reminder1hSentAt: timestamp('reminder_1h_sent_at', { withTimezone: true }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('appointment_therapistId_startAt_idx').on(table.therapistId, table.startAt),
		index('appointment_clientId_startAt_idx').on(table.clientId, table.startAt),
		index('appointment_slotId_idx').on(table.slotId),
		check(
			'appointment_client_xor_customName',
			sql`(${table.clientId} is not null)::int + (${table.customName} is not null)::int = 1`
		)
	]
);

export const therapistSettingsRelations = relations(therapistSettings, ({ one }) => ({
	therapist: one(therapist, {
		fields: [therapistSettings.therapistId],
		references: [therapist.id]
	})
}));

export const availabilitySlotRelations = relations(availabilitySlot, ({ one }) => ({
	therapist: one(therapist, {
		fields: [availabilitySlot.therapistId],
		references: [therapist.id]
	})
}));

export const appointmentRelations = relations(appointment, ({ one }) => ({
	therapist: one(therapist, { fields: [appointment.therapistId], references: [therapist.id] }),
	client: one(client, { fields: [appointment.clientId], references: [client.id] }),
	rescheduledFrom: one(appointment, {
		fields: [appointment.rescheduledFromId],
		references: [appointment.id]
	}),
	pack: one(paymentPack, { fields: [appointment.packId], references: [paymentPack.id] })
}));