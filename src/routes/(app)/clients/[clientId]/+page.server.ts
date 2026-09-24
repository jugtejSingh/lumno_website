import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	deleteClient,
	getClient,
	getClientCustomFields,
	listClients,
	resendInvite,
	updateClient,
	type ClientStatus
} from '$lib/server/clients';
import { getClientFieldHeadings, mergeClientFieldValues } from '$lib/server/clientFields';
import { listUpcomingAppointmentsForClient, listPastAppointmentsForClient } from '$lib/server/appointments';
import { addCharge, deletePayment, setPaymentStatus, updatePayment } from '$lib/server/payments';
import { resourceActions } from '$lib/server/resourceActions';
import { therapistScope } from '$lib/server/resources';
import { listClientsWithNotes } from '$lib/server/notes';
import { noteActions } from '$lib/server/noteActions';

const updateErrorMessages = {
	not_found: 'Client not found',
	limit_reached: "You've reached your plan's client limit — upgrade to bring them back"
} as const;

const resendErrorMessages = {
	not_found: 'Client not found',
	no_email: 'This client has no email on file',
	already_joined: 'This client already has portal access'
} as const;

const validStatuses: ClientStatus[] = ['active', 'paused', 'left'];

const PAYMENT_NOT_FOUND = 'That payment could not be found — it may have been deleted. Refresh and try again.';

function parseAmount(raw: FormDataEntryValue | null): number | null {
	const amount = Number(raw);
	if (!Number.isFinite(amount) || amount < 1) {
		return null;
	}
	return amount;
}

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const [client, fieldHeadings, allClients] = await Promise.all([
		getClient(therapist.id, event.params.clientId),
		getClientFieldHeadings(therapist.id),
		listClients(therapist.id)
	]);
	if (!client) {
		error(404, 'Client not found');
	}

	const [upcomingSessions, pastSessions, clientsWithNotes] = await Promise.all([
		listUpcomingAppointmentsForClient(client.id, therapist.timezone),
		listPastAppointmentsForClient(therapist.id, client.id, therapist.timezone),
		// ponytail: fetches every client's notes to pick out one; fine while rosters
		// are small, add a single-client notes query if this ever shows up in profiling
		listClientsWithNotes(therapist.id, therapist.timezone)
	]);
	const clientNotes = clientsWithNotes.find((c) => c.id === client.id) ?? {
		notes: [],
		sharedNotes: []
	};

	return {
		client,
		fieldHeadings,
		clients: allClients.map((c) => ({ id: c.id, name: c.name })),
		upcomingSessions,
		pastSessions,
		notes: clientNotes.notes,
		sharedNotes: clientNotes.sharedNotes,
		currency: therapist.currency
	};
};

export const actions: Actions = {
	// posted clientId is only trusted after therapistScope checks this therapist owns it
	...resourceActions((event, formData) => {
		return therapistScope(event.locals.therapistId!, formData.get('clientId')?.toString() ?? '');
	}),
	...noteActions(),

	update: async (event) => {
		const therapistId = event.locals.therapistId!;
		const clientId = event.params.clientId;
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const rateRaw = formData.get('rate')?.toString().trim() || '';
		const status = formData.get('status')?.toString() ?? '';
		const tags = (formData.get('tags')?.toString() ?? '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		if (!name.includes(' ')) {
			return fail(400, { fieldErrors: { name: 'Please enter their first and last name.' } });
		}
		if (!validStatuses.includes(status as ClientStatus)) {
			return fail(400, { message: 'Invalid status' });
		}

		const [headings, existingFields] = await Promise.all([
			getClientFieldHeadings(therapistId),
			getClientCustomFields(therapistId, clientId)
		]);
		if (existingFields === null) {
			return fail(400, { message: updateErrorMessages.not_found });
		}

		const result = await updateClient(therapistId, clientId, {
			name,
			rate: rateRaw ? Number(rateRaw) : null,
			customFields: mergeClientFieldValues(existingFields, headings, formData),
			tags,
			status: status as ClientStatus
		});
		if (result && 'error' in result && result.error !== undefined) {
			return fail(400, { message: updateErrorMessages[result.error] });
		}
	},

	delete: async (event) => {
		const therapistId = event.locals.therapistId!;
		await deleteClient(therapistId, event.params.clientId);
		redirect(303, '/clients');
	},

	resendInvite: async (event) => {
		const therapistId = event.locals.therapistId!;
		const result = await resendInvite(therapistId, event.params.clientId, event.url.origin);

		if ('error' in result && result.error !== undefined) {
			return fail(400, { message: resendErrorMessages[result.error] });
		}
		if (!result.emailSent) {
			return {
				inviteUrl: result.inviteUrl,
				message: 'The invite email could not be sent. Share this link with the client directly.'
			};
		}

		return { inviteUrl: result.inviteUrl };
	},

	addCharge: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const amount = parseAmount(formData.get('amount'));
		const note = formData.get('note')?.toString().trim() || null;

		if (amount === null) {
			return fail(400, { message: 'Enter an amount greater than 0' });
		}

		await addCharge(therapistId, { clientId: event.params.clientId, amount, note });
	},

	markPaid: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const found = await setPaymentStatus(therapistId, paymentId, 'paid');
		if (!found) {
			return fail(404, { message: PAYMENT_NOT_FOUND });
		}
	},

	updatePayment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const amount = parseAmount(formData.get('amount'));
		const note = formData.get('note')?.toString().trim() || null;

		if (amount === null) {
			return fail(400, { message: 'Enter an amount greater than 0' });
		}

		const found = await updatePayment(therapistId, paymentId, { amount, note });
		if (!found) {
			return fail(404, { message: PAYMENT_NOT_FOUND });
		}
	},

	deletePayment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const found = await deletePayment(therapistId, paymentId);
		if (!found) {
			return fail(404, { message: PAYMENT_NOT_FOUND });
		}
	}
};
