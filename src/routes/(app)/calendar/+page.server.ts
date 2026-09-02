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
import { getNotificationSettings, updateNotificationSettings } from '$lib/server/settings';
import { isGoogleCalendarConnected } from '$lib/server/googleCalendar';
import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import { addWalkInClient, listClients } from '$lib/server/clients';
import { listDayKindsForMonth } from '$lib/server/schedule';
import {
	getTherapistScheduleSettings,
	updateTherapistScheduleSettings,
	type ScheduleKind
} from '$lib/server/settings';

const validScheduleKinds: ScheduleKind[] = ['online', 'in_person', 'off'];

const addAppointmentErrorMessages = {
	invalid_range: 'End time must be after start time',
	overlap: 'That overlaps another confirmed appointment',
	invalid_client: 'That client could not be found'
} as const;

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

	const [appointments, clients, dayKinds, settings, notifications, googleConnected] = await Promise.all([
		listAppointmentsForMonth(therapist.id, year, month),
		listClients(therapist.id),
		listDayKindsForMonth(therapist.id, year, month),
		getTherapistScheduleSettings(therapist.id),
		getNotificationSettings(therapist.id),
		isGoogleCalendarConnected(therapist.userId)
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

	return { year, month, sessionsByDay, settings, notifications, googleConnected, clients, dayKinds };
};

export const actions: Actions = {
	addAppointment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		let clientId = formData.get('clientId')?.toString() ?? '';
		const customName = formData.get('customName')?.toString().trim() ?? '';
		const notes = formData.get('notes')?.toString().trim() || null;
		const year = Number(formData.get('year'));
		const month = Number(formData.get('month'));
		const day = Number(formData.get('day'));
		const startTime = formData.get('startTime')?.toString() ?? '';
		const endTime = formData.get('endTime')?.toString() ?? '';
		const modality = formData.get('modality')?.toString() === 'in_person' ? 'in_person' : 'online';

		if (customName) {
			const walkIn = await addWalkInClient(therapistId, customName);
			clientId = walkIn.id;
		}
		if (!clientId) {
			return fail(400, { message: 'Pick a client or enter a name' });
		}
		const [startHourRaw, startMinuteRaw] = startTime.split(':');
		const [endHourRaw, endMinuteRaw] = endTime.split(':');
		if (!startHourRaw || !startMinuteRaw || !endHourRaw || !endMinuteRaw) {
			return fail(400, { message: 'Pick a start and end time' });
		}

		const result = await createAppointmentForTherapist(therapistId, {
			clientId,
			year,
			month,
			day,
			startHour: Number(startHourRaw),
			startMinute: Number(startMinuteRaw),
			endHour: Number(endHourRaw),
			endMinute: Number(endMinuteRaw),
			modality,
			notes
		});

		if (result.error) {
			return fail(400, { message: addAppointmentErrorMessages[result.error] });
		}

		await attachMeetingLinkIfOnline(result.appointment!);
		await sendAppointmentEmail(result.appointment!.id, 'confirmed');
	},

	cancelAppointment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const appointmentId = formData.get('appointmentId')?.toString() ?? '';
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
		const formData = await event.request.formData();
		const appointmentId = formData.get('appointmentId')?.toString() ?? '';
		const year = Number(formData.get('year'));
		const month = Number(formData.get('month'));
		const day = Number(formData.get('day'));
		const startTime = formData.get('startTime')?.toString() ?? '';
		const endTime = formData.get('endTime')?.toString() ?? '';
		const modality = formData.get('modality')?.toString() === 'in_person' ? 'in_person' : 'online';

		const [startHourRaw, startMinuteRaw] = startTime.split(':');
		const [endHourRaw, endMinuteRaw] = endTime.split(':');
		if (!startHourRaw || !startMinuteRaw || !endHourRaw || !endMinuteRaw) {
			return fail(400, { message: 'Pick a start and end time' });
		}

		const result = await rescheduleAppointmentForTherapist(therapistId, appointmentId, {
			year,
			month,
			day,
			startHour: Number(startHourRaw),
			startMinute: Number(startMinuteRaw),
			endHour: Number(endHourRaw),
			endMinute: Number(endMinuteRaw),
			modality
		});

		if ('error' in result) {
			return fail(400, { message: rescheduleErrorMessages[result.error] });
		}
	},

	updateNotifications: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		await updateNotificationSettings(therapistId, {
			sendMeetLinks: formData.get('sendMeetLinks') === 'on',
			sendBookingEmails: formData.get('sendBookingEmails') === 'on'
		});
	},

	connectGoogleCalendar: async (event) => {
		let url: string | undefined;
		try {
			const result = await auth.api.linkSocialAccount({
				body: {
					provider: 'google',
					callbackURL: '/calendar',
					scopes: ['https://www.googleapis.com/auth/calendar.events']
				},
				headers: event.request.headers
			});
			url = result.url;
		} catch {
			return fail(500, { message: 'Could not start Google Calendar connection' });
		}
		if (!url) {
			return fail(500, { message: 'Could not start Google Calendar connection' });
		}
		return redirect(302, url);
	},

	updateSettings: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const bufferMinutes = Number(formData.get('bufferMinutes'));
		const earliestBookingTime = formData.get('earliestBookingTime')?.toString() ?? '';
		const latestBookingTime = formData.get('latestBookingTime')?.toString() ?? '';
		const weeklySchedule = formData.getAll('weeklySchedule').map((v) => v.toString());

		if (!earliestBookingTime || !latestBookingTime) {
			return fail(400, { message: 'Pick both working hours' });
		}
		if (latestBookingTime <= earliestBookingTime) {
			return fail(400, { message: 'Working hours must end after they start' });
		}
		if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
			return fail(400, { message: 'Buffer must be a non-negative number of minutes' });
		}
		if (weeklySchedule.length !== 7 || !weeklySchedule.every((k) => validScheduleKinds.includes(k as ScheduleKind))) {
			return fail(400, { message: 'Pick a valid type for every day of the week' });
		}

		await updateTherapistScheduleSettings(therapistId, {
			bufferMinutes,
			earliestBookingTime,
			latestBookingTime,
			weeklySchedule: weeklySchedule as ScheduleKind[]
		});
	}
};