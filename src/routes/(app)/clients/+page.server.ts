import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addClient,
	deleteClient,
	listClients,
	resendInvite,
	setClientStatus,
	type ClientStatus
} from '$lib/server/clients';

const addErrorMessages = {
	duplicate: 'You already have a client with that email',
	self: "You can't add yourself as a client",
	limit_reached: "You've reached your plan's client limit — upgrade to add more"
} as const;

const resendErrorMessages = {
	not_found: 'Client not found',
	no_email: 'This client has no email on file',
	already_joined: 'This client already has portal access'
} as const;

const validStatuses: ClientStatus[] = ['active', 'paused', 'left'];

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const clients = await listClients(therapist.id);
	return { clients };
};

export const actions: Actions = {
	add: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const email = formData.get('email')?.toString().trim() ?? '';
		const ageRaw = formData.get('age')?.toString().trim() || '';
		const rateRaw = formData.get('rate')?.toString().trim() || '';
		const bio = formData.get('bio')?.toString().trim() || null;
		const tags = (formData.get('tags')?.toString() ?? '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		if (!name.includes(' ')) {
			return fail(400, { message: 'Please enter their first and last name.' });
		}
		if (!email) {
			return fail(400, { message: 'Email is required to invite the client' });
		}

		const result = await addClient(
			therapistId,
			{
				name,
				email,
				age: ageRaw ? Number(ageRaw) : null,
				rate: rateRaw ? Number(rateRaw) : null,
				bio,
				tags
			},
			event.url.origin
		);

		if ('error' in result) {
			return fail(400, { message: addErrorMessages[result.error] });
		}
	},

	delete: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		await deleteClient(therapistId, clientId);
	},

	setStatus: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const status = formData.get('status')?.toString() ?? '';

		if (!validStatuses.includes(status as ClientStatus)) {
			return fail(400, { message: 'Invalid status' });
		}

		await setClientStatus(therapistId, clientId, status as ClientStatus);
	},

	resendInvite: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';

		const result = await resendInvite(therapistId, clientId, event.url.origin);

		if ('error' in result) {
			return fail(400, { message: resendErrorMessages[result.error] });
		}

		return { inviteUrl: result.inviteUrl };
	}
};