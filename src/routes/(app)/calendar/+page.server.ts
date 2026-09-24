import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import type { CalendarSession } from '$lib/types/calendar';
import {
	createAppointmentForTherapist,
	listAppointmentsForMonth,
	cancelAppointment,
	rescheduleAppointmentForTherapist,
	attachMeetingLinkIfOnline,
	markPastAppointmentsCompleted
} from '$lib/server/appointments';
import { sendAppointmentEmail } from '$lib/server/bookingEmails';
import { listClients } from '$lib/server/clients';
import { parseMonthParam } from '$lib/server/dateParams';
import { db } from '$lib/server/db';
import { client } from '$lib/server/db/schema';
import { addCharge } from '$lib/server/payments';
import { listDayKindsForMonth } from '$lib/server/schedule';
import {
	getSlotDesign,
	parseDesignedSlots,
	validateDaySlots,
	parseMaxSessions,
	replaceWeekTemplate,
	setDateOverride,
	clearDateOverride,
	toDateKey,
	type WeeklyDay
} from '$lib/server/availabilitySlots';
import { logError } from '$lib/server/log';
import { parseDateParts, parseTimeParts, type OverlapConflict } from '$lib/server/appointments';

const addAppointmentErrorMessages = {
	invalid_range: 'End time must be after start time',
	overlap: 'That overlaps another confirmed appointment',
	invalid_client: 'That client could not be found'
} as const;

// "Overlaps another appointment" is useless without saying which one — this is the
// therapist's own calendar, so naming the clashing slot leaks nothing.
function overlapMessage(conflict: OverlapConflict | undefined, timezone: string): string {
	if (!conflict) {
		return 'That overlaps another confirmed appointment';
	}
	const format = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
	const timeOnly = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		hour: 'numeric',
		minute: '2-digit'
	});
	return `That overlaps your confirmed session on ${format.format(conflict.startAt)} – ${timeOnly.format(conflict.endAt)}`;
}

const cancelErrorMessages = {
	not_found: 'That appointment could not be found',
	charge_required: 'Choose how much to charge before cancelling'
} as const;

const rescheduleErrorMessages = {
	not_found: 'That appointment could not be found',
	invalid_range: 'End time must be after start time',
	overlap: 'That overlaps another confirmed appointment',
	invalid_client: 'That client could not be found',
	// unreachable from this therapist-driven flow (only the client self-service reschedule
	// path re-checks availability/modality), kept here so the shared RescheduleAppointmentResult
	// error union stays exhaustive
	unavailable: 'That time is no longer available',
	modality_required: 'Choose online or in-person for that day'
} as const;

const modalityColor: Record<string, string> = {
	online: 'var(--citrus-400)',
	in_person: 'var(--plum-400)'
};

// cancelled/rescheduled/completed override the modality colour so dead and done sessions
// read differently at a glance; a live confirmed session keeps its modality colour.
const statusColor: Record<string, string> = {
	completed: 'var(--beige-600)',
	cancelled: 'var(--beige-300)',
	rescheduled: 'var(--beige-300)'
};

const modalityLabel: Record<string, string> = {
	online: 'Online',
	in_person: 'In Person'
};

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	await markPastAppointmentsCompleted(therapist.id);
	const now = new Date();
	const year = Number(event.url.searchParams.get('year')) || now.getFullYear();
	const month = parseMonthParam(event.url.searchParams.get('month'), now);

	const [appointments, clients, dayKinds, slotDesign] = await Promise.all([
		listAppointmentsForMonth(therapist.id, therapist.timezone, year, month),
		listClients(therapist.id),
		listDayKindsForMonth(therapist.id, year, month),
		getSlotDesign(therapist.id, year, month)
	]);
	appointments.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

	const timeOfDayFormat = new Intl.DateTimeFormat('en-GB', {
		timeZone: therapist.timezone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	});

	const sessionsByDay: Record<number, CalendarSession[]> = {};
	for (const appt of appointments) {
		const time = new Intl.DateTimeFormat('en-US', {
			timeZone: therapist.timezone,
			hour: 'numeric',
			minute: '2-digit'
		}).format(appt.startAt);
		(sessionsByDay[appt.day] ??= []).push({
			id: appt.id,
			time,
			name: appt.clientName,
			color: statusColor[appt.status] ?? modalityColor[appt.modality],
			notes: appt.notes,
			modality: appt.modality,
			modalityLabel: modalityLabel[appt.modality],
			status: appt.status,
			startTime: timeOfDayFormat.format(appt.startAt),
			endTime: timeOfDayFormat.format(appt.endAt),
			meetLink: appt.meetLink
		});
	}

	return { year, month, sessionsByDay, clients, dayKinds, slotDesign };
};

const MAX_SESSIONS_MESSAGE = 'Max sessions must be a whole number from 1 to 50, or blank for no limit';

function readJson(formData: FormData, field: string): unknown {
	try {
		return JSON.parse(formData.get(field)?.toString() ?? '');
	} catch {
		return null;
	}
}

export const actions: Actions = {
	saveWeekTemplate: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const raw = readJson(formData, 'week');
		if (!Array.isArray(raw) || raw.length !== 7) {
			return fail(400, { message: 'Could not read your weekly slots — reload and try again' });
		}

		const week: WeeklyDay[] = [];
		for (const rawDay of raw) {
			if (typeof rawDay !== 'object' || rawDay === null) {
				return fail(400, { message: 'Could not read your weekly slots — reload and try again' });
			}
			const { slots: rawSlots, maxSessions: rawMax, holiday } = rawDay as Record<string, unknown>;
			const daySlots = parseDesignedSlots(rawSlots);
			if (!daySlots) {
				return fail(400, { message: 'Could not read your weekly slots — reload and try again' });
			}
			const error = validateDaySlots(daySlots);
			if (error) {
				return fail(400, { message: error });
			}
			const maxSessions = parseMaxSessions(rawMax);
			if (maxSessions === undefined) {
				return fail(400, { message: MAX_SESSIONS_MESSAGE });
			}
			if (typeof holiday !== 'boolean') {
				return fail(400, { message: 'Could not read your weekly slots — reload and try again' });
			}
			week.push({ slots: daySlots, maxSessions, holiday });
		}

		await replaceWeekTemplate(therapistId, week);
	},

	saveDateOverride: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const date = parseDateParts(formData);
		if (!date) {
			return fail(400, { message: 'Pick a valid date' });
		}
		const slots = parseDesignedSlots(readJson(formData, 'slots'));
		if (!slots) {
			return fail(400, { message: 'Could not read that day’s slots — reload and try again' });
		}
		const error = validateDaySlots(slots);
		if (error) {
			return fail(400, { message: error });
		}
		const maxSessions = parseMaxSessions(formData.get('maxSessions')?.toString() ?? '');
		if (maxSessions === undefined) {
			return fail(400, { message: MAX_SESSIONS_MESSAGE });
		}

		await setDateOverride(therapistId, toDateKey(date.year, date.month, date.day), { slots, maxSessions });
	},

	clearDateOverride: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const date = parseDateParts(formData);
		if (!date) {
			return fail(400, { message: 'Pick a valid date' });
		}

		await clearDateOverride(therapistId, toDateKey(date.year, date.month, date.day));
	},

	addAppointment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const timezone = event.locals.therapist!.timezone;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const customName = formData.get('customName')?.toString().trim() ?? '';
		const rateRaw = formData.get('rate')?.toString().trim() || '';
		const notes = formData.get('notes')?.toString().trim() || null;
		const startTime = formData.get('startTime')?.toString() ?? '';
		const endTime = formData.get('endTime')?.toString() ?? '';
		const modality = formData.get('modality')?.toString() === 'in_person' ? 'in_person' : 'online';

		if (!customName && !clientId) {
			return fail(400, { message: 'Pick a client or enter a name' });
		}
		const date = parseDateParts(formData);
		if (!date) {
			return fail(400, { message: 'That date is not valid — close the dialog and pick the day again' });
		}
		const start = parseTimeParts(startTime);
		const end = parseTimeParts(endTime);
		if (!start || !end) {
			return fail(400, { message: 'Pick a valid start and end time' });
		}
		let rate = 0;
		if (rateRaw) {
			rate = Number(rateRaw);
			if (!Number.isFinite(rate) || rate < 0) {
				return fail(400, { message: 'Rate must be a number of 0 or more' });
			}
		}

		const result = await createAppointmentForTherapist(therapistId, {
			...(customName ? { customName } : { clientId }),
			year: date.year,
			month: date.month,
			day: date.day,
			startHour: start.hour,
			startMinute: start.minute,
			endHour: end.hour,
			endMinute: end.minute,
			modality,
			notes
		});

		if (result.error) {
			if (result.error === 'overlap') {
				return fail(409, { message: overlapMessage(result.conflict, timezone) });
			}
			return fail(400, { message: addAppointmentErrorMessages[result.error] });
		}

		const created = result.appointment!;

		// walk-ins have no client row to carry a rate, so charge the session up front
		// instead — the amount the therapist just typed, defaulting to 0 if left blank.
		// An existing client's own session rate is on their client row (same rate the
		// self-booking flow in availability.ts charges), so pull that instead.
		try {
			if (customName) {
				await addCharge(therapistId, { customName, appointmentId: created.id, amount: rate });
			} else {
				const [clientRow] = await db.select({ rate: client.rate }).from(client).where(eq(client.id, clientId));
				await addCharge(therapistId, { clientId, appointmentId: created.id, amount: clientRow?.rate ?? 0 });
			}
		} catch (err) {
			// The appointment exists; only the charge row is missing. Say so instead
			// of a 500 that makes it look like nothing was booked.
			logError('calendar.addAppointment.charge', err, { therapistId, appointmentId: created.id });
			return fail(500, {
				message:
					'The session was booked, but recording the charge failed — add it from the Payments page'
			});
		}

		// Both best-effort: Meet link creation logs and returns null on failure, and
		// the email helper swallows its own errors.
		await attachMeetingLinkIfOnline(created);
		await sendAppointmentEmail(created.id, 'confirmed');
	},

	cancelAppointment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const appointmentId = formData.get('appointmentId')?.toString() ?? '';
		if (!appointmentId) {
			return fail(400, { message: cancelErrorMessages.not_found });
		}
		const chargeRaw = formData.get('chargeTier')?.toString();
		const manualTier =
			chargeRaw === 'free' || chargeRaw === 'partial' || chargeRaw === 'full' ? chargeRaw : undefined;

		const result = await cancelAppointment(therapistId, appointmentId, undefined, manualTier);
		if ('error' in result) {
			return fail(400, { message: cancelErrorMessages[result.error] });
		}
	},

	rescheduleAppointment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const timezone = event.locals.therapist!.timezone;
		const formData = await event.request.formData();
		const appointmentId = formData.get('appointmentId')?.toString() ?? '';
		const startTime = formData.get('startTime')?.toString() ?? '';
		const endTime = formData.get('endTime')?.toString() ?? '';
		const modality = formData.get('modality')?.toString() === 'in_person' ? 'in_person' : 'online';

		if (!appointmentId) {
			return fail(400, { message: rescheduleErrorMessages.not_found });
		}
		const date = parseDateParts(formData);
		if (!date) {
			return fail(400, { message: 'Pick a valid date' });
		}
		const start = parseTimeParts(startTime);
		const end = parseTimeParts(endTime);
		if (!start || !end) {
			return fail(400, { message: 'Pick a valid start and end time' });
		}

		const result = await rescheduleAppointmentForTherapist(therapistId, appointmentId, {
			year: date.year,
			month: date.month,
			day: date.day,
			startHour: start.hour,
			startMinute: start.minute,
			endHour: end.hour,
			endMinute: end.minute,
			modality
		});

		if ('error' in result) {
			if (result.error === 'overlap') {
				return fail(409, { message: overlapMessage(result.conflict, timezone) });
			}
			return fail(400, { message: rescheduleErrorMessages[result.error] });
		}
	}
};