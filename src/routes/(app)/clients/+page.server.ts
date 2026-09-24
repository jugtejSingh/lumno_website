import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addClient, deleteClient, listClients, resendInvite } from '$lib/server/clients';
import { getClientFieldHeadings, mergeClientFieldValues } from '$lib/server/clientFields';

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

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const [clients, fieldHeadings] = await Promise.all([
		listClients(therapist.id),
		getClientFieldHeadings(therapist.id)
	]);
	return { clients, fieldHeadings };
};

export const actions: Actions = {
	add: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const email = formData.get('email')?.toString().trim() ?? '';
		const rateRaw = formData.get('rate')?.toString().trim() || '';

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

		const headings = await getClientFieldHeadings(therapistId);
		const result = await addClient(
			therapistId,
			{
				name,
				email,
				rate: rateRaw ? Number(rateRaw) : null,
				customFields: mergeClientFieldValues({}, headings, formData),
				// tags are filled in later via Edit client
				tags: []
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