import { and, eq, gte, lt, ne } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { appointment, therapist, therapistSettings, client, availabilityException } from '$lib/server/db/schema';
import { zonedDayBounds, zonedDateToUTC, getZonedWeekday, parseTimeOfDay } from '$lib/server/timezone';
import { getPaymentSettings } from '$lib/server/paymentSettings';
import { getTherapistScheduleSettings } from '$lib/server/settings';
import { getActivePackForClient, hasOutstandingBalance, addCharge, completePackIfExhausted } from '$lib/server/payments';
import { attachMeetingLinkIfOnline, finishReschedule, type RescheduleAppointmentResult } from '$lib/server/appointments';
import { sendAppointmentEmail } from '$lib/server/bookingEmails';

// fixed session length for client self-booking; the therapist's own manual
// bookings (createAppointmentForTherapist) can still use any start/end.
const SESSION_MINUTES = 60;
// clients can only book within the next 2 weeks
const BOOKING_WINDOW_DAYS = 14;

export type AvailableSlot = { startTime: string; label: string; modality: 'online' | 'in_person' };

/**
 * Open booking slots per day of the month, in the therapist's own timezone.
 * Deliberately reveals nothing about *why* a day/slot is unavailable (off day,
 * outside working hours, already booked, in the past) — every excluded slot
 * just doesn't appear, so a client can't infer another client's schedule.
 */
export async function listAvailabilityForMonth(therapistId: string, year: number, month: number) {
	const [therapistRow] = await db
		.select({ timezone: therapist.timezone })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	const timezone = therapistRow?.timezone ?? 'Asia/Kolkata';

	const { weeklySchedule, bufferMinutes, earliestBookingTime, latestBookingTime } =
		await getTherapistScheduleSettings(therapistId);
	const [earliestHour, earliestMinute] = parseTimeOfDay(earliestBookingTime);
	const [latestHour, latestMinute] = parseTimeOfDay(latestBookingTime);
	const latestTotalMinutes = latestHour * 60 + latestMinute;

	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const { start: monthStart } = zonedDayBounds(year, month, 1, timezone);
	const { end: monthEnd } = zonedDayBounds(year, month, daysInMonth, timezone);

	const [exceptions, appointments] = await Promise.all([
		db
			.select({
				startAt: availabilityException.startAt,
				endAt: availabilityException.endAt,
				kind: availabilityException.kind
			})
			.from(availabilityException)
			.where(
				and(
					eq(availabilityException.therapistId, therapistId),
					lt(availabilityException.startAt, monthEnd),
					gte(availabilityException.endAt, monthStart)
				)
			),
		db
			.select({ startAt: appointment.startAt, endAt: appointment.endAt })
			.from(appointment)
			.where(
				and(
					eq(appointment.therapistId, therapistId),
					lt(appointment.startAt, monthEnd),
					gte(appointment.endAt, monthStart),
					ne(appointment.status, 'cancelled'),
					ne(appointment.status, 'rescheduled')
				)
			)
	]);

	const now = new Date();
	const windowEnd = new Date(now.getTime() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
	const slotsByDay: Record<number, AvailableSlot[]> = {};

	for (let day = 1; day <= daysInMonth; day++) {
		const { start: dayStart, end: dayEnd } = zonedDayBounds(year, month, day, timezone);
		const exception = exceptions.find((ex) => ex.startAt < dayEnd && ex.endAt > dayStart);
		const kind = exception ? exception.kind : weeklySchedule[getZonedWeekday(dayStart, timezone)];
		if (kind === 'off') continue;

		const dayAppointments = appointments.filter((a) => a.startAt < dayEnd && a.endAt > dayStart);
		const slots: AvailableSlot[] = [];

		let minutesFromMidnight = earliestHour * 60 + earliestMinute;
		while (minutesFromMidnight + SESSION_MINUTES <= latestTotalMinutes) {
			const hour = Math.floor(minutesFromMidnight / 60);
			const minute = minutesFromMidnight % 60;
			const slotStart = zonedDateToUTC(year, month, day, hour, minute, timezone);
			const slotEnd = new Date(slotStart.getTime() + SESSION_MINUTES * 60_000);

			const blocked =
				slotStart <= now ||
				slotStart > windowEnd ||
				dayAppointments.some(
					(a) =>
						slotStart.getTime() < a.endAt.getTime() + bufferMinutes * 60_000 &&
						slotEnd.getTime() > a.startAt.getTime() - bufferMinutes * 60_000
				);

			if (!blocked) {
				const label = new Intl.DateTimeFormat('en-US', {
					timeZone: timezone,
					hour: 'numeric',
					minute: '2-digit'
				}).format(slotStart);
				slots.push({
					startTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
					label,
					modality: kind
				});
			}

			minutesFromMidnight += SESSION_MINUTES;
		}

		if (slots.length > 0) slotsByDay[day] = slots;
	}

	return slotsByDay;
}

export type BookSlotResult = {
	appointment?: typeof appointment.$inferSelect;
	error?: 'unavailable' | 'overlap' | 'balance_due' | 'pack_exhausted' | 'client_inactive';
};

// Just the slot-check + insert, no payment/pack side effects — shared by a brand-new
// booking (which needs those side effects) and a reschedule (which deliberately doesn't:
// the session already has its financial links, they just move, see moveFinancialLinksOnReschedule).
async function insertAppointmentForClient(
	therapistId: string,
	clientId: string,
	input: { year: number; month: number; day: number; startTime: string },
	extra: { packId?: string | null; rescheduledFromId?: string | null } = {},
	executor: DbOrTx = db
): Promise<{ appointment: typeof appointment.$inferSelect } | { error: 'unavailable' | 'overlap' }> {
	const slotsByDay = await listAvailabilityForMonth(therapistId, input.year, input.month);
	const slot = slotsByDay[input.day]?.find((s) => s.startTime === input.startTime);
	if (!slot) {
		return { error: 'unavailable' as const };
	}

	const [therapistRow] = await executor
		.select({ timezone: therapist.timezone })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	const timezone = therapistRow?.timezone ?? 'Asia/Kolkata';

	const [hourRaw, minuteRaw] = input.startTime.split(':');
	const startAt = zonedDateToUTC(input.year, input.month, input.day, Number(hourRaw), Number(minuteRaw), timezone);
	const endAt = new Date(startAt.getTime() + SESSION_MINUTES * 60_000);

	try {
		const [row] = await executor
			.insert(appointment)
			.values({
				therapistId,
				clientId,
				startAt,
				endAt,
				modality: slot.modality,
				notes: null,
				packId: extra.packId ?? null,
				rescheduledFromId: extra.rescheduledFromId ?? null
			})
			.returning();
		return { appointment: row };
	} catch (err) {
		if (err instanceof Error && err.message.includes('appointment_overlaps_existing_booking')) {
			return { error: 'overlap' as const };
		}
		throw err;
	}
}

export async function createAppointmentForClient(
	therapistId: string,
	clientId: string,
	input: { year: number; month: number; day: number; startTime: string }
): Promise<BookSlotResult> {
	const [clientRow] = await db
		.select({ rate: client.rate, deactivatedAt: client.deactivatedAt })
		.from(client)
		.where(eq(client.id, clientId));
	// set by syncClientActivationForCap when the therapist is over their plan's
	// client cap — blocks new bookings only, existing sessions still show/reschedule.
	if (clientRow?.deactivatedAt) {
		return { error: 'client_inactive' as const };
	}

	const [settingsRow] = await db
		.select({ requireZeroBalance: therapistSettings.requireZeroBalance })
		.from(therapistSettings)
		.where(eq(therapistSettings.therapistId, therapistId));
	if (settingsRow?.requireZeroBalance && (await hasOutstandingBalance(therapistId, clientId))) {
		return { error: 'balance_due' as const };
	}

	const paymentSettings = await getPaymentSettings(therapistId);
	const activePack = paymentSettings.packsEnabled ? await getActivePackForClient(clientId) : null;
	const packHasCredit = !!activePack && activePack.remaining > 0;
	if (activePack && !packHasCredit && paymentSettings.packExhaustedAction === 'block_booking') {
		return { error: 'pack_exhausted' as const };
	}

	const result = await db.transaction(async (tx) => {
		const inserted = await insertAppointmentForClient(
			therapistId,
			clientId,
			input,
			{ packId: packHasCredit ? activePack!.id : null },
			tx
		);
		if ('error' in inserted) {
			return inserted;
		}

		if (packHasCredit) {
			await completePackIfExhausted(activePack!.id, tx);
		} else {
			await addCharge(therapistId, { clientId, appointmentId: inserted.appointment.id, amount: clientRow?.rate ?? 0 }, tx);
		}

		return inserted;
	});
	if ('error' in result) {
		return result;
	}

	const withMeetLink = await attachMeetingLinkIfOnline(result.appointment);
	await sendAppointmentEmail(withMeetLink.id, 'confirmed');
	return { appointment: withMeetLink };
}

// Client self-service reschedule — re-checks open slots same as a new booking. The
// status-flip/fee/financial-link/Meet-link tail is shared with the therapist-driven version
// via finishReschedule (appointments.ts); only the new row's insert differs here (a fixed
// slot re-validated against open availability, vs. the therapist's arbitrary time range).
export async function rescheduleAppointmentForClient(
	therapistId: string,
	clientId: string,
	oldAppointmentId: string,
	input: { year: number; month: number; day: number; startTime: string }
): Promise<RescheduleAppointmentResult> {
	const [oldAppt] = await db
		.select()
		.from(appointment)
		.where(
			and(
				eq(appointment.id, oldAppointmentId),
				eq(appointment.therapistId, therapistId),
				eq(appointment.clientId, clientId)
			)
		);
	if (
		!oldAppt ||
		oldAppt.status === 'cancelled' ||
		oldAppt.status === 'rescheduled' ||
		oldAppt.status === 'completed'
	) {
		return { error: 'not_found' as const };
	}

	return finishReschedule(therapistId, oldAppt, (tx) =>
		insertAppointmentForClient(therapistId, clientId, input, { rescheduledFromId: oldAppt.id }, tx)
	);
}