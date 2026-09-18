import { error, json, text } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { logInfo } from '$lib/server/log';

// Meta's one-time subscription handshake: echo hub.challenge back as plain text.
export const GET: RequestHandler = async ({ url }) => {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	if (mode !== 'subscribe' || token !== env.WHATSAPP_VERIFY_TOKEN || !challenge) {
		error(403, 'verification_failed');
	}

	return text(challenge);
};

// ponytail: logs the payload and nothing else. Add signature verification
// (x-hub-signature-256 over the raw body) before this does anything real.
export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();
	logInfo('whatsapp.webhook', rawBody);
	return json({ received: true });
};
