import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { therapist, user, client as clientTable } from '$lib/server/db/schema';
import { listClientsForUser, setClientPhone } from '$lib/server/clients';
import { parsePhone } from '$lib/phone';
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
import { formatCancellationPolicy } from '$lib/server/paymentPolicy';
import { formatCurrency } from '$lib/format';

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
	const timezone = therapistRow?.timezone ?? 'Asia/Kolkata';
	const currency = therapistRow?.currency ?? 'INR';

	const now = new Date();
	const year = Number(event.url.searchParams.get('year')) || now.getFullYear();
	const month = Number(event.url.searchParams.get('month') ?? now.getMonth());
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
		therapistName,
		year,
		month,
		slotsByDay,
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
		cancellationPolicy: formatCancellationPolicy(paymentSettings)
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

	// the client editing their own phone number. Unverified — see setClientPhone.
	saveDetails: async (event) => {
		if (!event.locals.clientId) {
			return fail(401);
		}

		const formData = await event.request.formData();
		const parsedPhone = parsePhone(formData.get('phone')?.toString());
		if ('error' in parsedPhone) {
			return fail(400, { message: parsedPhone.error });
		}

		await setClientPhone(event.locals.clientId, parsedPhone.phone);
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
