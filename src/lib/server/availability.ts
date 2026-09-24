import { and, eq, gte, lt, ne, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { appointment, therapist, client } from '$lib/server/db/schema';
import { zonedDayBounds, zonedDateToUTC, parseTimeOfDay } from '$lib/server/timezone';
import { listDesignedDaysForMonth } from '$lib/server/availabilitySlots';
import { getBookingRules } from '$lib/server/settings';
import {
	getActivePackForClient,
	hasOutstandingBalance,
	addCharge,
	completePackIfExhausted
} from '$lib/server/payments';
import {
	attachMeetingLinkIfOnline,
	finishReschedule,
	isOverlapError,
	type RescheduleAppointmentResult
} from '$lib/server/appointments';
import { sendAppointmentEmail } from '$lib/server/bookingEmails';

// clients can only book within the next 2 weeks
const BOOKING_WINDOW_DAYS = 14;

export type AvailableSlot = {
	startTime: string; // "HH:MM", therapist's local time
	endTime: string;
	label: string;
	// 'hybrid' means the slot itself is hybrid — the client must choose online/in_person at booking time
	modality: 'online' | 'in_person' | 'hybrid';
};

/**
 * Open booking slots per day of the month, in the therapist's own timezone.
 * Deliberately reveals nothing about *why* a day/slot is unavailable (off day,
 * outside working hours, already booked, in the past) — every excluded slot
 * just doesn't appear, so a client can't infer another client's schedule.
 */
export async function listAvailabilityForMonth(
	therapistId: string,
	year: number,
	month: number,
	// a session being rescheduled: left out of the daily cap count, so a client can move it
	// to another time on the same full day
	ignoreAppointmentId: string | null = null
) {
	const [therapistRow] = await db
		.select({ timezone: therapist.timezone })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	const timezone = therapistRow?.timezone ?? 'Asia/Kolkata';

	// Slots are handcrafted by the therapist (availabilitySlots.ts); the therapist's own
	// manual bookings (createAppointmentForTherapist) can still use any start/end.
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const { start: monthStart } = zonedDayBounds(year, month, 1, timezone);
	const { end: monthEnd } = zonedDayBounds(year, month, daysInMonth, timezone);

	const [designByDay, appointments] = await Promise.all([
		listDesignedDaysForMonth(therapistId, year, month),
		db
			.select({ id: appointment.id, startAt: appointment.startAt, endAt: appointment.endAt })
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
		const design = designByDay[day];
		if (design.slots.length === 0) continue;

		const { start: dayStart, end: dayEnd } = zonedDayBounds(year, month, day, timezone);
		const dayAppointments = appointments.filter((a) => a.startAt < dayEnd && a.endAt > dayStart);

		// Daily cap: counts every confirmed/completed session starting that day, the therapist's
		// own bookings included. A full day shows no slots at all — cancelling or moving a
		// session away drops the count and reopens it.
		// ponytail: counted outside the insert transaction, so two clients booking the last
		// place at the same moment can both get in; take a per-therapist lock if that matters
		if (design.maxSessions !== null) {
			let sessionsThatDay = 0;
			for (const a of dayAppointments) {
				if (a.startAt >= dayStart && a.id !== ignoreAppointmentId) {
					sessionsThatDay++;
				}
			}
			if (sessionsThatDay >= design.maxSessions) {
				continue;
			}
		}

		const slots: AvailableSlot[] = [];

		for (const designed of design.slots) {
			const [hour, minute] = parseTimeOfDay(designed.startTime);
			const [endHour, endMinute] = parseTimeOfDay(designed.endTime);
			const slotStart = zonedDateToUTC(year, month, day, hour, minute, timezone);
			const slotEnd = zonedDateToUTC(year, month, day, endHour, endMinute, timezone);

			const blocked =
				slotStart <= now ||
				slotStart > windowEnd ||
				dayAppointments.some((a) => slotStart < a.endAt && slotEnd > a.startAt);

			if (!blocked) {
				const label = new Intl.DateTimeFormat('en-US', {
					timeZone: timezone,
					hour: 'numeric',
					minute: '2-digit'
				}).format(slotStart);
				slots.push({
					startTime: designed.startTime,
					endTime: designed.endTime,
					label,
					modality: designed.modality
				});
			}
		}

		if (slots.length > 0) slotsByDay[day] = slots;
	}

	return slotsByDay;
}

export type BookSlotResult = {
	appointment?: typeof appointment.$inferSelect;
	error?:
		| 'unavailable'
		| 'overlap'
		| 'modality_required'
		| 'balance_due'
		| 'booking_limit'
		| 'client_inactive';
};

// Just the slot-check + insert, no payment/pack side effects — shared by a brand-new
// booking (which needs those side effects) and a reschedule (which deliberately doesn't:
// the session already has its financial links, they just move, see moveFinancialLinksOnReschedule).
async function insertAppointmentForClient(
	therapistId: string,
	clientId: string,
	input: {
		year: number;
		month: number;
		day: number;
		startTime: string;
		modality?: 'online' | 'in_person';
	},
	extra: { packId?: string | null; rescheduledFromId?: string | null } = {},
	executor: DbOrTx = db
): Promise<
	| { appointment: typeof appointment.$inferSelect }
	| { error: 'unavailable' | 'overlap' | 'modality_required' }
> {
	const slotsByDay = await listAvailabilityForMonth(
		therapistId,
		input.year,
		input.month,
		extra.rescheduledFromId ?? null
	);
	const slot = slotsByDay[input.day]?.find((s) => s.startTime === input.startTime);
	if (!slot) {
		return { error: 'unavailable' as const };
	}

	// dedicated days ignore any client-supplied modality; only a hybrid day lets the client choose
	const modality = slot.modality === 'hybrid' ? input.modality : slot.modality;
	if (!modality) {
		return { error: 'modality_required' as const };
	}

	const [therapistRow] = await executor
		.select({ timezone: therapist.timezone })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	const timezone = therapistRow?.timezone ?? 'Asia/Kolkata';

	const [hour, minute] = parseTimeOfDay(slot.startTime);
	const [endHour, endMinute] = parseTimeOfDay(slot.endTime);
	const startAt = zonedDateToUTC(input.year, input.month, input.day, hour, minute, timezone);
	const endAt = zonedDateToUTC(input.year, input.month, input.day, endHour, endMinute, timezone);

	try {
		// savepoint: postgres-js rethrows any failed query at the end of the enclosing
		// transaction even if it was caught, so the trigger error must be contained here
		const [row] = await executor.transaction((savepoint) =>
			savepoint
				.insert(appointment)
				.values({
					therapistId,
					clientId,
					startAt,
					endAt,
					modality,
					notes: null,
					packId: extra.packId ?? null,
					rescheduledFromId: extra.rescheduledFromId ?? null
				})
				.returning()
		);
		return { appointment: row };
	} catch (err) {
		if (isOverlapError(err)) {
			return { error: 'overlap' as const };
		}
		throw err;
	}
}

export async function createAppointmentForClient(
	therapistId: string,
	clientId: string,
	input: {
		year: number;
		month: number;
		day: number;
		startTime: string;
		modality?: 'online' | 'in_person';
	}
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

	const bookingRules = await getBookingRules(therapistId);
	if (bookingRules.requireZeroBalance && (await hasOutstandingBalance(therapistId, clientId))) {
		return { error: 'balance_due' as const };
	}
	if (bookingRules.maxUpcomingBookingsPerClient !== null) {
		// ponytail: counted outside the insert transaction, so two simultaneous bookings can
		// both slip under the cap by one; lock the client row in the tx if that ever matters
		const [upcoming] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(appointment)
			.where(
				and(
					eq(appointment.therapistId, therapistId),
					eq(appointment.clientId, clientId),
					eq(appointment.status, 'confirmed'),
					gte(appointment.startAt, new Date())
				)
			);
		if (upcoming.count >= bookingRules.maxUpcomingBookingsPerClient) {
			return { error: 'booking_limit' as const };
		}
	}

	// an exhausted (or absent) pack simply falls through to a regular-price charge below
	const activePack = await getActivePackForClient(clientId);
	const packHasCredit = !!activePack && activePack.remaining > 0;

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
			await addCharge(
				therapistId,
				{ clientId, appointmentId: inserted.appointment.id, amount: clientRow?.rate ?? 0 },
				tx
			);
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
	input: {
		year: number;
		month: number;
		day: number;
		startTime: string;
		modality?: 'online' | 'in_person';
	}
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
