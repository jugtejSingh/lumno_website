import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { parseMonthParam } from '$lib/server/dateParams';
import { therapist, user, client as clientTable } from '$lib/server/db/schema';
import {
	listClientsForUser,
	setClientPhone,
	setClientProfile,
	setClientTimezone
} from '$lib/server/clients';
import { parsePhone } from '$lib/phone';
import { hasClientProfile, parseClientProfile } from '$lib/clientProfile';
import { setActiveClientCookie } from '$lib/server/activeClient';
import {
	listUpcomingAppointmentsForClient,
	cancelAppointment,
	markPastAppointmentsCompleted,
	parseDateParts,
	parseTimeParts
} from '$lib/server/appointments';
import {
	listAvailabilityForMonth,
	createAppointmentForClient,
	rescheduleAppointmentForClient
} from '$lib/server/availability';
import { listSharedNotesForClient } from '$lib/server/notes';
import { getBalanceDueForClient, listVisiblePaymentsForClient } from '$lib/server/payments';
import { getPaymentSettings, getManualPayDetails } from '$lib/server/paymentSettings';
import { signedUrl } from '$lib/server/storage';
import { connectionHealth } from '$lib/server/razorpayConnection';
import { startInvoiceCheckout } from '$lib/server/sessionPayments';
import { formatCancellationPolicy, formatReschedulePolicy } from '$lib/server/paymentPolicy';
import { formatCurrency } from '$lib/format';
import { resourceActions } from '$lib/server/resourceActions';
import { clientScope, listResources } from '$lib/server/resources';
import type { ResourceRow } from '$lib/types/resources';

const modalityLabel: Record<string, string> = {
	online: 'Online session',
	in_person: 'In-person session'
};

export const load: PageServerLoad = async (event) => {
	const { client } = await event.parent();
	await markPastAppointmentsCompleted(client.therapistId);

	const [therapistRow] = await db
		.select({ name: user.name, timezone: therapist.timezone, currency: therapist.currency })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(therapist.id, client.therapistId));

	const clientName = client.name;
	const therapistName = therapistRow?.name ?? 'your therapist';
	const therapistTimezone = therapistRow?.timezone ?? 'Asia/Kolkata';
	// only display formatting (session list, invoice/notes dates) uses this — booking
	// and availability always stay on the therapist's own timezone
	const timezone = client.timezone ?? therapistTimezone;
	const currency = therapistRow?.currency ?? 'INR';

	const now = new Date();
	const year = Number(event.url.searchParams.get('year')) || now.getFullYear();
	const month = parseMonthParam(event.url.searchParams.get('month'), now);
	const PAGE_SIZE = 5;
	const paymentsPage = Math.max(1, Number(event.url.searchParams.get('paymentsPage')) || 1);
	const notesPage = Math.max(1, Number(event.url.searchParams.get('notesPage')) || 1);

	const [upcoming, slotsByDay, sharedNotes, payments, balanceDue, paymentSettings, rzpHealth, manualPayRow] =
		await Promise.all([
			listUpcomingAppointmentsForClient(client.id, timezone),
			listAvailabilityForMonth(client.therapistId, year, month),
			listSharedNotesForClient(client.id, notesPage, PAGE_SIZE),
			listVisiblePaymentsForClient(client.id, paymentsPage, PAGE_SIZE),
			getBalanceDueForClient(client.id),
			getPaymentSettings(client.therapistId),
			connectionHealth(client.therapistId),
			getManualPayDetails(client.therapistId)
		]);

	// Reschedule picker: leave the session being moved out of the daily max-sessions count,
	// so the client can move it to another time on its own full day. Only honoured for this
	// client's own upcoming session — any other id would reveal how full a day is.
	let rescheduleId: string | null = null;
	const rescheduleParam = event.url.searchParams.get('reschedule');
	for (const appt of upcoming) {
		if (appt.id === rescheduleParam) {
			rescheduleId = appt.id;
		}
	}
	let resources: ResourceRow[] = [];
	const resourceScope = await clientScope(client.id);
	if (resourceScope) {
		resources = await listResources(resourceScope);
	}

	let openSlotsByDay = slotsByDay;
	if (rescheduleId !== null) {
		openSlotsByDay = await listAvailabilityForMonth(client.therapistId, year, month, rescheduleId);
	}

	// ponytail: gate on 'connected' per design §12.9. 'expiring' also has live
	// tokens but refreshExpiresAt is pushed 180d out on every refresh, so it
	// realistically never shows before the Phase 3 cron lands.
	const portalPayEnabled =
		currency === 'INR' && rzpHealth === 'connected' && paymentSettings.paymentMode === 'automatic';

	// Off-platform payment details. Shown whenever the therapist filled them in —
	// paying directly stays available alongside "Pay now" in automatic mode.
	let manualPay: { qrUrl: string | null; bankDetails: string | null } | null = null;
	if (manualPayRow.qrKey || manualPayRow.bankDetails) {
		let qrUrl: string | null = null;
		if (manualPayRow.qrKey) {
			qrUrl = await signedUrl(manualPayRow.qrKey);
		}
		manualPay = { qrUrl, bankDetails: manualPayRow.bankDetails };
	}

	const sessions = upcoming.map((appt) => ({
		id: appt.id,
		when: appt.when,
		type: modalityLabel[appt.modality] ?? 'Session',
		status: appt.status,
		tone: 'success' as const,
		meetLink: appt.meetLink
	}));

	const invoices = payments.rows.map((p) => ({
		id: p.id,
		date: p.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
		amount: formatCurrency(p.amount, currency),
		note: p.note,
		payable: portalPayEnabled
	}));
	const paymentsTotal = payments.total;

	const notes = sharedNotes.rows.map((n) => ({
		date: n.createdAt.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}),
		text: n.body // markdown source, rendered client-side
	}));
	const notesTotal = sharedNotes.total;

	return {
		clientName,
		clientPhone: client.phone ?? '',
		clientTimezone: client.timezone ?? '',
		therapistTimezone,
		timezoneOptions: Intl.supportedValuesOf('timeZone'),
		clientProfile: {
			dateOfBirth: client.dateOfBirth ?? '',
			gender: client.gender ?? '',
			city: client.city ?? '',
			state: client.state ?? '',
			country: client.country ?? ''
		},
		// clients who joined before these were collected get nudged to fill them in
		profileComplete: hasClientProfile(client),
		therapistName,
		year,
		month,
		slotsByDay: openSlotsByDay,
		rescheduleId,
		sessions,
		invoices,
		paymentsPage,
		paymentsTotal,
		sharedNotes: notes,
		notesPage,
		notesTotal,
		pageSize: PAGE_SIZE,
		balanceDue: formatCurrency(balanceDue, currency),
		hasBalanceDue: balanceDue > 0,
		manualPay,
		cancellationPolicy: formatCancellationPolicy(paymentSettings),
		reschedulePolicy: formatReschedulePolicy(paymentSettings),
		resources
	};
};

const bookSessionErrorMessages = {
	unavailable: 'That time is no longer available',
	overlap: 'That time was just booked — pick another',
	modality_required: 'Choose online or in-person for that day',
	balance_due:
		'You have an outstanding balance — please settle it with your therapist before booking',
	booking_limit:
		'You already have the maximum number of upcoming sessions — you can book another after your next one',
	pack_exhausted: 'Your session pack is used up — contact your therapist to book another session',
	client_inactive: 'Your therapist needs to upgrade their plan before you can book a new session'
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
	// scope comes from the session's active client, never from the posted form
	...resourceActions(async (event) => {
		if (!event.locals.clientId) {
			return null;
		}
		return clientScope(event.locals.clientId);
	}),

	switchClient: async (event) => {
		if (!event.locals.user) {
			return fail(401);
		}

		const clientId = (await event.request.formData()).get('clientId')?.toString();

		// never trust the posted clientId on its own — only switch to a row that's
		// actually one of this user's own client profiles
		const owned = await listClientsForUser(event.locals.user.id);
		if (!clientId || !owned.some((row) => row.id === clientId)) {
			return fail(403, { message: 'Not your client profile' });
		}

		setActiveClientCookie(event.cookies, clientId);
		return redirect(302, '/portal');
	},

	// the client editing their own phone number and display timezone. Phone is
	// unverified — see setClientPhone.
	saveDetails: async (event) => {
		if (!event.locals.clientId) {
			return fail(401);
		}

		const formData = await event.request.formData();
		const parsedPhone = parsePhone(formData.get('phone')?.toString());
		if ('error' in parsedPhone) {
			return fail(400, { message: parsedPhone.error });
		}

		// '' means "use the therapist's timezone" — cleared back to null
		const timezoneRaw = formData.get('timezone')?.toString() ?? '';
		if (timezoneRaw && !Intl.supportedValuesOf('timeZone').includes(timezoneRaw)) {
			return fail(400, { message: 'Pick a valid timezone' });
		}

		await setClientPhone(event.locals.clientId, parsedPhone.phone);
		await setClientTimezone(event.locals.clientId, timezoneRaw || null);
	},

	// the client's own date of birth / gender / location, all required. The therapist
	// sees these read-only.
	saveProfile: async (event) => {
		if (!event.locals.clientId) {
			return fail(403, { message: 'Not a client' });
		}
		const parsedProfile = parseClientProfile(await event.request.formData());
		if ('error' in parsedProfile) {
			return fail(400, { profileMessage: parsedProfile.error });
		}
		await setClientProfile(event.locals.clientId, parsedProfile.profile);
	},

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

	cancelSession: async (event) => {
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

		const result = await cancelAppointment(
			clientRow.therapistId,
			appointmentId,
			event.locals.clientId
		);
		if ('error' in result) {
			return fail(400, { message: 'That session could not be found' });
		}
	},

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
	},

	payInvoice: async (event) => {
		if (!event.locals.clientId) {
			return fail(401);
		}
		const paymentId = (await event.request.formData()).get('paymentId')?.toString() ?? '';
		const result = await startInvoiceCheckout(event.locals.clientId, paymentId);
		if (!result.ok) {
			return fail(400, { message: result.message });
		}
		return {
			checkout: {
				orderId: result.orderId,
				key: result.key,
				amountMinor: result.amountMinor,
				therapistName: result.therapistName
			}
		};
	}
};
