import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	deleteIntakeResponse,
	getIntakeResponse,
	importIntakeResponse
} from '$lib/server/intakeResponses';

const importErrorMessages = {
	not_found: 'That response could not be found — it may have been deleted',
	no_email: "This response has no email address, so it can't be imported",
	duplicate: 'You already have a client with that email',
	self: "You can't add yourself as a client",
	limit_reached: "You've reached your plan's client limit — upgrade to add more"
} as const;

export const load: PageServerLoad = async (event) => {
	const response = await getIntakeResponse(event.locals.therapistId!, event.params.responseId);
	if (!response) {
		error(404, 'Response not found');
	}
	return { response };
};

export const actions: Actions = {
	import: async (event) => {
		const result = await importIntakeResponse(
			event.locals.therapistId!,
			event.params.responseId,
			event.url.origin
		);
		if ('error' in result) {
			return fail(400, { message: importErrorMessages[result.error] });
		}
		if (!result.emailSent && result.inviteUrl) {
			// the client is saved; only the email bounced (same handling as the Clients page)
			return {
				inviteUrl: result.inviteUrl,
				message:
					'The client was added, but the invite email could not be sent. Share this link with them directly or use Resend invite later.'
			};
		}
		return { imported: true };
	},

	delete: async (event) => {
		await deleteIntakeResponse(event.locals.therapistId!, event.params.responseId);
		redirect(303, '/intake');
	}
};
