import { eq } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { therapistSettings } from '$lib/server/db/schema';

// Rules checked when a client books from their portal (availability.ts). The therapist's
// own Calendar bookings skip both.
export type BookingRules = {
	requireZeroBalance: boolean;
	maxUpcomingBookingsPerClient: number | null; // null = no limit
};

export async function getBookingRules(therapistId: string): Promise<BookingRules> {
	const [row] = await db
		.select({
			requireZeroBalance: therapistSettings.requireZeroBalance,
			maxUpcomingBookingsPerClient: therapistSettings.maxUpcomingBookingsPerClient
		})
		.from(therapistSettings)
		.where(eq(therapistSettings.therapistId, therapistId));
	// ponytail: row seeded at therapist creation (therapistProfile.ts), always present
	return row!;
}

export async function updateBookingRules(therapistId: string, input: BookingRules, executor: DbOrTx = db) {
	await executor
		.update(therapistSettings)
		.set(input)
		.where(eq(therapistSettings.therapistId, therapistId));
}

export type NotificationSettings = {
	sendMeetLinks: boolean;
	sendBookingEmails: boolean;
	sendSessionReminderEmails: boolean;
	sendPaymentReminderEmails: boolean;
	sendRebookReminderEmails: boolean;
};

export async function getNotificationSettings(therapistId: string): Promise<NotificationSettings> {
	const [row] = await db
		.select({
			sendMeetLinks: therapistSettings.sendMeetLinks,
			sendBookingEmails: therapistSettings.sendBookingEmails,
			sendSessionReminderEmails: therapistSettings.sendSessionReminderEmails,
			sendPaymentReminderEmails: therapistSettings.sendPaymentReminderEmails,
			sendRebookReminderEmails: therapistSettings.sendRebookReminderEmails
		})
		.from(therapistSettings)
		.where(eq(therapistSettings.therapistId, therapistId));
	// ponytail: row seeded at therapist creation (therapistProfile.ts), always present
	return row!;
}

export async function updateNotificationSettings(
	therapistId: string,
	input: NotificationSettings,
	executor: DbOrTx = db
) {
	await executor
		.update(therapistSettings)
		.set(input)
		.where(eq(therapistSettings.therapistId, therapistId));
}
