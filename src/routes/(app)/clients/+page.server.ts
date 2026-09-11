import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addClient,
	deleteClient,
	listClients,
	resendInvite,
	updateClient,
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

const updateErrorMessages = {
	not_found: 'Client not found',
	limit_reached: "You've reached your plan's client limit — upgrade to bring them back"
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

		const fieldErrors: Record<string, string> = {};
		if (!name.includes(' ')) {
			fieldErrors.name = 'Please enter their first and last name.';
		}
		if (!email) {
			fieldErrors.email = 'Email is required to invite the client';
		}
		if (Object.keys(fieldErrors).length > 0) {
			return fail(400, { fieldErrors });
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

		if ('error' in result && result.error !== undefined) {
			if (result.error === 'duplicate' || result.error === 'self') {
				return fail(400, { fieldErrors: { email: addErrorMessages[result.error] } });
			}
			return fail(400, { message: addErrorMessages[result.error] });
		}
		if (!result.emailSent) {
			// The client is saved; only the email bounced. Hand back the link so the
			// therapist can share it by hand, and say what happened.
			return {
				inviteUrl: result.inviteUrl,
				message: `${name} was added, but the invite email could not be sent. Share this link with them directly or use Resend invite later.`
			};
		}
	},

	delete: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		await deleteClient(therapistId, clientId);
	},

	update: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';
		const ageRaw = formData.get('age')?.toString().trim() || '';
		const rateRaw = formData.get('rate')?.toString().trim() || '';
		const bio = formData.get('bio')?.toString().trim() || null;
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

		const result = await updateClient(therapistId, clientId, {
			name,
			age: ageRaw ? Number(ageRaw) : null,
			rate: rateRaw ? Number(rateRaw) : null,
			bio,
			tags,
			status: status as ClientStatus
		});
		if (result && 'error' in result && result.error !== undefined) {
			return fail(400, { message: updateErrorMessages[result.error] });
		}
	},

	resendInvite: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';

		const result = await resendInvite(therapistId, clientId, event.url.origin);

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
	}
};