import { getZonedDateParts, zonedDateToUTC } from '$lib/server/timezone';

/**
 * Exclusive end of a booking window: local midnight after the last open day, so with a 14-day
 * window a whole day opens at 00:00 in the therapist's timezone, never slot by slot.
 *
 * Clients get `windowDays`; reserved sessions are booked with `windowDays + 1`, so they exist a
 * full day before the day opens to everyone else (and count towards that day's session cap).
 */
export function bookingWindowEnd(now: Date, timezone: string, windowDays: number): Date {
	const today = getZonedDateParts(now, timezone);
	return zonedDateToUTC(today.year, today.month, today.day + windowDays + 1, 0, 0, timezone);
}
