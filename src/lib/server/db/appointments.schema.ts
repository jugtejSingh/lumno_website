import { relations } from 'drizzle-orm';
import {
	pgTable,
	text,
	timestamp,
	time,
	integer,
	boolean,
	index,
	pgEnum,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { therapist, client } from './users.schema';
import { paymentPack } from './payments.schema';

// used for both the recurring weekly pattern and one-off exceptions —
// 'off' doubles as "holiday" when applied to a specific date via availabilityException
export const scheduleKindEnum = pgEnum('schedule_kind', ['online', 'in_person', 'off']);
export const appointmentModalityEnum = pgEnum('appointment_modality', ['online', 'in_person']);
export const appointmentStatusEnum = pgEnum('appointment_status', [
	'confirmed',
	'cancelled',
	'completed',
	'rescheduled'
]);

const allOnlineWeek = [
	'online',
	'online',
	'online',
	'online',
	'online',
	'online',
	'online'
] as const;

export const therapistSettings = pgTable('therapist_settings', {
	therapistId: text('therapist_id')
		.primaryKey()
		.references(() => therapist.id, { onDelete: 'cascade' }),
	// index 0 = Sunday ... index 6 = Saturday
	weeklySchedule: scheduleKindEnum('weekly_schedule').array().notNull().default([...allOnlineWeek]),
	earliestBookingTime: time('earliest_booking_time').notNull().default('09:00'),
	latestBookingTime: time('latest_booking_time').notNull().default('20:00'),
	bufferMinutes: integer('buffer_minutes').notNull().default(0),
	maxBookingsPerClientPerWeek: integer('max_bookings_per_client_per_week'),
	// stub: real enforcement needs a payments/ledger table
	requireZeroBalance: boolean('require_zero_balance').notNull().default(false),
	// whether an online appointment gets a Google Meet link generated at booking/reschedule
	// time. Only meaningful once the therapist has connected Google (calendar.events scope on
	// their account row) — off just means "don't create a link", it doesn't disconnect anything
	sendMeetLinks: boolean('send_meet_links').notNull().default(true),
	// whether the booking-confirmed / cancelled / rescheduled client emails go out. Independent
	// of sendMeetLinks and of Google connection — unrelated to the always-on verification/invite mail
	sendBookingEmails: boolean('send_booking_emails').notNull().default(true)
});

export const availabilityException = pgTable(
	'availability_exception',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'cascade' }),
		startAt: timestamp('start_at', { withTimezone: true }).notNull(),
		endAt: timestamp('end_at', { withTimezone: true }).notNull(),
		kind: scheduleKindEnum('kind').notNull()
	},
	(table) => [index('availabilityException_therapistId_startAt_idx').on(table.therapistId, table.startAt)]
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
		clientId: text('client_id')
			.notNull()
			.references(() => client.id, { onDelete: 'cascade' }),
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
		notes: text('notes'),
		// set for online appointments when the therapist has a connected Google account;
		// null otherwise (no Meet link shown)
		meetLink: text('meet_link'),
		// Google Calendar event id backing meetLink — needed to patch/delete the event on
		// reschedule/cancel, since Google's API keys off the event id, not the link
		googleEventId: text('google_event_id'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('appointment_therapistId_startAt_idx').on(table.therapistId, table.startAt),
		index('appointment_clientId_startAt_idx').on(table.clientId, table.startAt)
	]
);

export const therapistSettingsRelations = relations(therapistSettings, ({ one }) => ({
	therapist: one(therapist, {
		fields: [therapistSettings.therapistId],
		references: [therapist.id]
	})
}));

export const availabilityExceptionRelations = relations(availabilityException, ({ one }) => ({
	therapist: one(therapist, {
		fields: [availabilityException.therapistId],
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