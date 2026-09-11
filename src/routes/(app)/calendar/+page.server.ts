import { fail } from '@sveltejs/kit';
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
import { addCharge } from '$lib/server/payments';
import { listDayKindsForMonth } from '$lib/server/schedule';
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
	return `That overlaps your confirmed session on ${format.format(conflict.startAt)} – ${timeOnly.format(conflict.endAt)} (including your buffer time)`;
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
	// path re-checks availability), kept here so the shared RescheduleAppointmentResult
	// error union stays exhaustive
	unavailable: 'That time is no longer available'
} as const;

const modalityColor: Record<string, string> = {
	online: 'var(--sage-300)',
	in_person: 'var(--plum-300)'
};

// cancelled/rescheduled/completed override the modality colour so dead and done sessions
// read differently at a glance; a live confirmed session keeps its modality colour.
const statusColor: Record<string, string> = {
	completed: 'var(--sage-500)',
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
	const month = Number(event.url.searchParams.get('month') ?? now.getMonth());

	const [appointments, clients, dayKinds] = await Promise.all([
		listAppointmentsForMonth(therapist.id, therapist.timezone, year, month),
		listClients(therapist.id),
		listDayKindsForMonth(therapist.id, year, month)
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

	return { year, month, sessionsByDay, clients, dayKinds };
};

export const actions: Actions = {
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
		// instead — the amount the therapist just typed, defaulting to 0 if left blank
		if (customName) {
			try {
				await addCharge(therapistId, { customName, appointmentId: created.id, amount: rate });
			} catch (err) {
				// The appointment exists; only the charge row is missing. Say so instead
				// of a 500 that makes it look like nothing was booked.
				logError('calendar.addAppointment.charge', err, { therapistId, appointmentId: created.id });
				return fail(500, {
					message:
						'The session was booked, but recording the charge failed — add it from the Payments page'
				});
			}
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