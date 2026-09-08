import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { therapist, user, client as clientTable } from '$lib/server/db/schema';
import { listClientsForUser } from '$lib/server/clients';
import { setActiveClientCookie } from '$lib/server/activeClient';
import {
	listUpcomingAppointmentsForClient,
	cancelAppointment,
	markPastAppointmentsCompleted
} from '$lib/server/appointments';
import {
	listAvailabilityForMonth,
	createAppointmentForClient,
	rescheduleAppointmentForClient
} from '$lib/server/availability';
import { listSharedNotesForClient } from '$lib/server/notes';
import { listVisiblePaymentsForClient } from '$lib/server/payments';
import { getPaymentSettings } from '$lib/server/paymentSettings';
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

	const [upcoming, slotsByDay, sharedNoteRows, payments, paymentSettings, rzpHealth] =
		await Promise.all([
			listUpcomingAppointmentsForClient(client.id, timezone),
			listAvailabilityForMonth(client.therapistId, year, month),
			listSharedNotesForClient(client.id),
			listVisiblePaymentsForClient(client.id),
			getPaymentSettings(client.therapistId),
			connectionHealth(client.therapistId)
		]);

	// ponytail: gate on 'connected' per design §12.9. 'expiring' also has live
	// tokens but refreshExpiresAt is pushed 180d out on every refresh, so it
	// realistically never shows before the Phase 3 cron lands.
	const portalPayEnabled = currency === 'INR' && rzpHealth === 'connected';

	const sessions = upcoming.map((appt) => ({
		id: appt.id,
		when: appt.when,
		type: modalityLabel[appt.modality] ?? 'Session',
		status: appt.status,
		tone: 'success' as const,
		meetLink: appt.meetLink
	}));

	const balanceDue = payments
		.filter((p) => p.status === 'unpaid')
		.reduce((sum, p) => sum + p.amount, 0);
	const paidTotal = payments
		.filter((p) => p.status === 'paid')
		.reduce((sum, p) => sum + p.amount, 0);

	const invoices = payments.map((p) => ({
		id: p.id,
		date: (p.paidAt ?? p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
		amount: formatCurrency(p.amount, currency),
		note: p.note,
		status: p.status,
		tone: p.status === 'paid' ? ('success' as const) : ('citrus' as const),
		due: p.status === 'unpaid',
		payable: p.status === 'unpaid' && portalPayEnabled
	}));

	const sharedNotes = sharedNoteRows.map((n) => ({
		date: n.createdAt.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}),
		text: n.body // markdown source, rendered client-side
	}));

	return {
		clientName,
		therapistName,
		year,
		month,
		slotsByDay,
		sessions,
		invoices,
		sharedNotes,
		balanceDue: formatCurrency(balanceDue, currency),
		paidTotal: formatCurrency(paidTotal, currency),
		cancellationPolicy: formatCancellationPolicy(paymentSettings)
	};
};

const bookSessionErrorMessages = {
	unavailable: 'That time is no longer available',
	overlap: 'That time was just booked — pick another',
	balance_due:
		'You have an outstanding balance — please settle it with your therapist before booking',
	pack_exhausted: 'Your session pack is used up — contact your therapist to book another session',
	client_inactive: 'Your therapist needs to upgrade their plan before you can book a new session'
} as const;

const rescheduleErrorMessages = {
	not_found: 'That session could not be found',
	unavailable: 'That time is no longer available',
	overlap: 'That time was just booked — pick another',
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
		const year = Number(formData.get('year'));
		const month = Number(formData.get('month'));
		const day = Number(formData.get('day'));
		const startTime = formData.get('startTime')?.toString() ?? '';

		const result = await createAppointmentForClient(clientRow.therapistId, event.locals.clientId, {
			year,
			month,
			day,
			startTime
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
		const year = Number(formData.get('year'));
		const month = Number(formData.get('month'));
		const day = Number(formData.get('day'));
		const startTime = formData.get('startTime')?.toString() ?? '';

		const result = await rescheduleAppointmentForClient(
			clientRow.therapistId,
			event.locals.clientId,
			appointmentId,
			{
				year,
				month,
				day,
				startTime
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
