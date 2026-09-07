import { and, eq, gte, lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { therapist, availabilityException } from '$lib/server/db/schema';
import { zonedDayBounds, getZonedWeekday } from '$lib/server/timezone';
import { getTherapistScheduleSettings } from '$lib/server/settings';

/** Effective schedule kind ('online' | 'in_person' | 'off') for each day of the month. */
export async function listDayKindsForMonth(therapistId: string, year: number, month: number) {
	const [therapistRow] = await db
		.select({ timezone: therapist.timezone })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	const timezone = therapistRow?.timezone ?? 'Asia/Kolkata';

	const { weeklySchedule } = await getTherapistScheduleSettings(therapistId);

	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const { start } = zonedDayBounds(year, month, 1, timezone);
	const { end } = zonedDayBounds(year, month, daysInMonth, timezone);

	const exceptions = await db
		.select({
			startAt: availabilityException.startAt,
			endAt: availabilityException.endAt,
			kind: availabilityException.kind
		})
		.from(availabilityException)
		.where(
			and(
				eq(availabilityException.therapistId, therapistId),
				lt(availabilityException.startAt, end),
				gte(availabilityException.endAt, start)
			)
		);

	const dayKinds: Record<number, 'online' | 'in_person' | 'off'> = {};
	for (let day = 1; day <= daysInMonth; day++) {
		const { start: dayStart, end: dayEnd } = zonedDayBounds(year, month, day, timezone);
		const exception = exceptions.find((ex) => ex.startAt < dayEnd && ex.endAt > dayStart);
		if (exception) {
			dayKinds[day] = exception.kind;
			continue;
		}
		const weekday = getZonedWeekday(dayStart, timezone);
		dayKinds[day] = weeklySchedule[weekday];
	}

	return dayKinds;
}