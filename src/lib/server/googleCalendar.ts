import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { google } from 'googleapis';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';

// Best-effort Google Meet creation for online appointments. Every function here
// returns null/no-ops instead of throwing when the therapist hasn't connected Google
// or granted the calendar scope — a missing Meet link should never block booking.

// "Connected" = this therapist's Google account row carries the calendar.events scope.
// Read live off the account table, not denormalized onto therapist_settings.
export async function isGoogleCalendarConnected(therapistUserId: string): Promise<boolean> {
	const [row] = await db
		.select({ scope: account.scope })
		.from(account)
		.where(and(eq(account.userId, therapistUserId), eq(account.providerId, 'google')));
	return !!row?.scope && row.scope.includes('calendar.events');
}

async function getCalendarClient(therapistUserId: string) {
	const [googleAccount] = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, therapistUserId), eq(account.providerId, 'google')));
	if (!googleAccount) return null;

	try {
		const { accessToken } = await auth.api.getAccessToken({
			body: { accountId: googleAccount.id, userId: therapistUserId }
		});
		if (!accessToken) return null;

		const oauth2Client = new google.auth.OAuth2();
		oauth2Client.setCredentials({ access_token: accessToken });
		return google.calendar({ version: 'v3', auth: oauth2Client });
	} catch {
		return null;
	}
}

export type MeetEvent = { eventId: string; meetLink: string | null };

export async function createMeetEvent(
	therapistUserId: string,
	input: { summary: string; startAt: Date; endAt: Date; attendeeEmail?: string | null }
): Promise<MeetEvent | null> {
	const calendar = await getCalendarClient(therapistUserId);
	if (!calendar) return null;

	try {
		const { data } = await calendar.events.insert({
			calendarId: 'primary',
			conferenceDataVersion: 1,
			requestBody: {
				summary: input.summary,
				start: { dateTime: input.startAt.toISOString() },
				end: { dateTime: input.endAt.toISOString() },
				attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
				conferenceData: { createRequest: { requestId: randomUUID() } }
			}
		});
		if (!data.id) return null;
		return { eventId: data.id, meetLink: data.hangoutLink ?? null };
	} catch {
		return null;
	}
}

// Moves an existing event to a new time without touching its Meet link, so a client who
// already saved/joined via the old link doesn't get a dead one on reschedule.
export async function patchMeetEventTime(
	therapistUserId: string,
	eventId: string,
	input: { startAt: Date; endAt: Date }
): Promise<void> {
	const calendar = await getCalendarClient(therapistUserId);
	if (!calendar) return;

	try {
		await calendar.events.patch({
			calendarId: 'primary',
			eventId,
			requestBody: {
				start: { dateTime: input.startAt.toISOString() },
				end: { dateTime: input.endAt.toISOString() }
			}
		});
	} catch {
		// best-effort
	}
}

export async function deleteMeetEvent(therapistUserId: string, eventId: string): Promise<void> {
	const calendar = await getCalendarClient(therapistUserId);
	if (!calendar) return;

	try {
		await calendar.events.delete({ calendarId: 'primary', eventId });
	} catch {
		// best-effort
	}
}