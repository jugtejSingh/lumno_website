import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { therapistSettings } from '$lib/server/db/schema';

export const BOOKING_NOTE_MAX_LENGTH = 1000;

// The therapist's note shown on the client booking calendar. Empty string when unset,
// so callers never have to null-check it.
export async function getBookingNote(therapistId: string): Promise<string> {
	const [row] = await db
		.select({ bookingNote: therapistSettings.bookingNote })
		.from(therapistSettings)
		.where(eq(therapistSettings.therapistId, therapistId));
	return row?.bookingNote ?? '';
}

export async function setBookingNote(therapistId: string, note: string) {
	const trimmed = note.trim().slice(0, BOOKING_NOTE_MAX_LENGTH);
	let value: string | null = null;
	if (trimmed.length > 0) {
		value = trimmed;
	}
	await db
		.update(therapistSettings)
		.set({ bookingNote: value })
		.where(eq(therapistSettings.therapistId, therapistId));
}
