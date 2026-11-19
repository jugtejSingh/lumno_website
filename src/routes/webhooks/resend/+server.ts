import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyResendWebhook } from '$lib/server/email';
import { markInviteBounced } from '$lib/server/clients';
import { logError } from '$lib/server/log';

// Resend delivery events. Only hard bounces of invite emails do anything: the client
// gets an "Invite bounced" badge on the therapist's list. Every other verified event
// gets a 200 so Resend doesn't keep retrying it.
// Set up in the Resend dashboard: endpoint /webhooks/resend, event email.bounced,
// signing secret in RESEND_WEBHOOK_SECRET.
export const POST: RequestHandler = async ({ request }) => {
	// raw body — the signature is over the exact bytes Resend sent
	const payload = await request.text();
	const headers = {
		id: request.headers.get('svix-id') ?? '',
		timestamp: request.headers.get('svix-timestamp') ?? '',
		signature: request.headers.get('svix-signature') ?? ''
	};

	let event;
	try {
		event = verifyResendWebhook(payload, headers);
	} catch (err) {
		logError('webhooks.resend.verify', err);
		error(400, 'invalid signature');
	}

	if (event.type === 'email.bounced') {
		// soft bounces (mailbox full, etc.) can still deliver later — only flag permanent ones
		if (event.data.bounce.type === 'Permanent') {
			await markInviteBounced(event.data.email_id);
		}
	}

	return new Response('ok');
};
