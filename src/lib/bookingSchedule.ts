// Shared by the server and the UI: how often a reserved client repeats, and how far ahead
// clients can book (which is also how far ahead reserved sessions are booked).

export const RESERVED_EVERY_WEEKS_CHOICES = [
	{ weeks: 1, label: 'Every week' },
	{ weeks: 2, label: 'Every 2 weeks' },
	{ weeks: 4, label: 'Every 4 weeks' }
];

export const RESERVED_EVERY_WEEKS_OPTIONS: number[] = [];
for (const choice of RESERVED_EVERY_WEEKS_CHOICES) {
	RESERVED_EVERY_WEEKS_OPTIONS.push(choice.weeks);
}

export function reservedFrequencyLabel(weeks: number): string {
	for (const choice of RESERVED_EVERY_WEEKS_CHOICES) {
		if (choice.weeks === weeks) {
			return choice.label;
		}
	}
	return RESERVED_EVERY_WEEKS_CHOICES[0].label;
}

// "1 month" is 4 weeks, matching the every-4-weeks frequency
export const BOOKING_WINDOW_CHOICES = [
	{ days: 7, label: '1 week' },
	{ days: 14, label: '2 weeks' },
	{ days: 21, label: '3 weeks' },
	{ days: 28, label: '1 month' }
];

export const BOOKING_WINDOW_DAYS_OPTIONS: number[] = [];
for (const choice of BOOKING_WINDOW_CHOICES) {
	BOOKING_WINDOW_DAYS_OPTIONS.push(choice.days);
}

export const DEFAULT_BOOKING_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
// a clock change can make "N weeks later" a bit shorter than N * 7 * 24h
const DST_SLACK_MS = 12 * 60 * 60 * 1000;

/**
 * True when a reserved slot that repeats every `everyWeeks` weeks should skip `startAt`: one of
 * its earlier sessions (any status, so a cancelled or moved week still counts) sits closer than
 * that many weeks before it. A weekly slot never skips. The first session of a new reservation
 * has no earlier one, so it books on the next matching weekday.
 */
export function isTooSoonAfterLastHold(startAt: Date, earlierHolds: Date[], everyWeeks: number): boolean {
	if (everyWeeks <= 1) {
		return false;
	}
	const minGapMs = everyWeeks * WEEK_DAYS * DAY_MS - DST_SLACK_MS;
	for (const earlier of earlierHolds) {
		const gapMs = startAt.getTime() - earlier.getTime();
		if (gapMs > 0 && gapMs < minGapMs) {
			return true;
		}
	}
	return false;
}
