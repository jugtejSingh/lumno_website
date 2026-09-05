import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { therapistSettings } from '$lib/server/db/schema';

export type ScheduleKind = 'online' | 'in_person' | 'off';

// index 0 = Sunday ... index 6 = Saturday, matches therapistSettings.weeklySchedule
export type WeeklySchedule = ScheduleKind[];

export type TherapistScheduleSettings = {
	bufferMinutes: number;
	earliestBookingTime: string; // "HH:MM:SS"
	latestBookingTime: string;
	weeklySchedule: WeeklySchedule;
};

const defaults: TherapistScheduleSettings = {
	bufferMinutes: 0,
	earliestBookingTime: '09:00',
	latestBookingTime: '20:00',
	weeklySchedule: ['online', 'online', 'online', 'online', 'online', 'online', 'online']
};

export async function getTherapistScheduleSettings(therapistId: string): Promise<TherapistScheduleSettings> {
	const [row] = await db
		.select({
			bufferMinutes: therapistSettings.bufferMinutes,
			earliestBookingTime: therapistSettings.earliestBookingTime,
			latestBookingTime: therapistSettings.latestBookingTime,
			weeklySchedule: therapistSettings.weeklySchedule
		})
		.from(therapistSettings)
		.where(eq(therapistSettings.therapistId, therapistId));
	return row ?? defaults;
}

export async function updateTherapistScheduleSettings(
	therapistId: string,
	input: TherapistScheduleSettings
) {
	await db
		.insert(therapistSettings)
		.values({ therapistId, ...input })
		.onConflictDoUpdate({ target: therapistSettings.therapistId, set: input });
}

export type NotificationSettings = {
	sendMeetLinks: boolean;
	sendBookingEmails: boolean;
	sendSessionReminderEmails: boolean;
	sendPaymentReminderEmails: boolean;
};

const notificationDefaults: NotificationSettings = {
	sendMeetLinks: true,
	sendBookingEmails: true,
	sendSessionReminderEmails: true,
	sendPaymentReminderEmails: true
};

export async function getNotificationSettings(therapistId: string): Promise<NotificationSettings> {
	const [row] = await db
		.select({
			sendMeetLinks: therapistSettings.sendMeetLinks,
			sendBookingEmails: therapistSettings.sendBookingEmails,
			sendSessionReminderEmails: therapistSettings.sendSessionReminderEmails,
			sendPaymentReminderEmails: therapistSettings.sendPaymentReminderEmails
		})
		.from(therapistSettings)
		.where(eq(therapistSettings.therapistId, therapistId));
	return row ?? notificationDefaults;
}

export async function updateNotificationSettings(therapistId: string, input: NotificationSettings) {
	await db
		.insert(therapistSettings)
		.values({ therapistId, ...input })
		.onConflictDoUpdate({ target: therapistSettings.therapistId, set: input });
}
