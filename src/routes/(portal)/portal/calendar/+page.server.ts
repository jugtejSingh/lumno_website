import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { parseMonthParam } from '$lib/server/dateParams';
import { client as clientTable } from '$lib/server/db/schema';
import { parseDateParts, parseTimeParts } from '$lib/server/appointments';
import {
	listAvailabilityForMonth,
	createAppointmentForClient,
	rescheduleAppointmentForClient
} from '$lib/server/availability';
import { getBookingNote } from '$lib/server/bookingNote';
import { formatCancellationPolicy, formatReschedulePolicy } from '$lib/server/paymentPolicy';
import { loadPortalSessions, cancelSessionAction } from '$lib/server/portalSessions';

export const load: PageServerLoad = async (event) => {
	const { client, displayTimezone } = await event.parent();

	const now = new Date();
	const year = Number(event.url.searchParams.get('year')) || now.getFullYear();
	const month = parseMonthParam(event.url.searchParams.get('month'), now);

	const [portalSessions, slotsByDay, bookingNote] = await Promise.all([
		loadPortalSessions(client.id, client.therapistId, displayTimezone),
		listAvailabilityForMonth(client.therapistId, year, month),
		getBookingNote(client.therapistId)
	]);

	// Reschedule picker: leave the session being moved out of the daily max-sessions count,
	// so the client can move it to another time on its own full day. Only honoured for this
	// client's own upcoming session — any other id would reveal how full a day is.
	let rescheduleId: string | null = null;
	const rescheduleParam = event.url.searchParams.get('reschedule');
	for (const appt of portalSessions.upcoming) {
		if (appt.id === rescheduleParam) {
			rescheduleId = appt.id;
		}
	}

	let openSlotsByDay = slotsByDay;
	if (rescheduleId !== null) {
		openSlotsByDay = await listAvailabilityForMonth(client.therapistId, year, month, rescheduleId);
	}

	return {
		year,
		month,
		slotsByDay: openSlotsByDay,
		packRemaining: portalSessions.packRemaining,
		packUsedUp: portalSessions.packUsedUp,
		bookingNote,
		rescheduleId,
		sessions: portalSessions.sessions,
		cancellationPolicy: formatCancellationPolicy(portalSessions.paymentSettings),
		reschedulePolicy: formatReschedulePolicy(portalSessions.paymentSettings)
	};
};

const bookSessionErrorMessages = {
	unavailable: 'That time is no longer available',
	overlap: 'That time was just booked — pick another',
	modality_required: 'Choose online or in-person for that day',
	balance_due:
		'You have an outstanding balance — please settle it with your practitioner before booking',
	booking_limit:
		'You already have the maximum number of upcoming sessions — you can book another after your next one',
	client_inactive: 'Your practitioner needs to upgrade their plan before you can book a new session'
} as const;

const rescheduleErrorMessages = {
	not_found: 'That session could not be found',
	unavailable: 'That time is no longer available',
	overlap: 'That time was just booked — pick another',
	modality_required: 'Choose online or in-person for that day',
	// unreachable from this client self-service flow (only the therapist-driven reschedule
	// path allows an invalid range or a cross-therapist client id), kept here so the shared
	// RescheduleAppointmentResult error union stays exhaustive
	invalid_range: 'End time must be after start time',
	invalid_client: 'That client could not be found'
} as const;

export const actions: Actions = {
	bookSession: async (event) => {
		if (!event.locals.clientId) {
			return fail(401);
		}

		const [clientRow] = await db
			.select({ therapistId: clientTable.therapistId })
			.from(clientTable)
			.where(eq(clientTable.id, event.locals.clientId));
		if (!clientRow) {
			return fail(403);
		}

		const formData = await event.request.formData();
		const date = parseDateParts(formData);
		const startTime = formData.get('startTime')?.toString() ?? '';
		if (!date || !parseTimeParts(startTime)) {
			return fail(400, { message: 'Pick a day and a time slot' });
		}
		const modalityRaw = formData.get('modality')?.toString();
		const modality = modalityRaw === 'online' || modalityRaw === 'in_person' ? modalityRaw : undefined;

		const result = await createAppointmentForClient(clientRow.therapistId, event.locals.clientId, {
			year: date.year,
			month: date.month,
			day: date.day,
			startTime,
			modality
		});

		if (result.error) {
			return fail(400, { message: bookSessionErrorMessages[result.error] });
		}
	},

	cancelSession: cancelSessionAction,

	rescheduleSession: async (event) => {
		if (!event.locals.clientId) {
			return fail(401);
		}

		const [clientRow] = await db
			.select({ therapistId: clientTable.therapistId })
			.from(clientTable)
			.where(eq(clientTable.id, event.locals.clientId));
		if (!clientRow) {
			return fail(403);
		}

		const formData = await event.request.formData();
		const appointmentId = formData.get('appointmentId')?.toString() ?? '';
		const date = parseDateParts(formData);
		const startTime = formData.get('startTime')?.toString() ?? '';
		if (!appointmentId) {
			return fail(400, { message: rescheduleErrorMessages.not_found });
		}
		if (!date || !parseTimeParts(startTime)) {
			return fail(400, { message: 'Pick a day and a time slot' });
		}
		const modalityRaw = formData.get('modality')?.toString();
		const modality = modalityRaw === 'online' || modalityRaw === 'in_person' ? modalityRaw : undefined;

		const result = await rescheduleAppointmentForClient(
			clientRow.therapistId,
			event.locals.clientId,
			appointmentId,
			{
				year: date.year,
				month: date.month,
				day: date.day,
				startTime,
				modality
			}
		);

		if ('error' in result) {
			return fail(400, { message: rescheduleErrorMessages[result.error] });
		}
	}
};
