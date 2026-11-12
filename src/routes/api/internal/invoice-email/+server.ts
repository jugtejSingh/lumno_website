import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Config } from '@sveltejs/adapter-vercel';
import type { RequestHandler } from './$types';
import { sendInvoiceEmail } from '$lib/server/invoiceEmail';
import { isValidEmail } from '$lib/isValidEmail';

// Server-to-server only: the app calls this (invoiceEmailRequest.ts) with the
// shared secret. A different config gives it its own Vercel function, so only
// this one carries Chromium; 2 GB is the plan max and the fastest (CPU scales
// with memory).
export const config: Config = {
	memory: 2048,
	maxDuration: 30
};

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	// fail closed: a missing secret must not accept "Bearer undefined"
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
		error(401, 'Unauthorized');
	}

	const body = await request.json().catch(() => null);
	if (
		!body ||
		typeof body.therapistId !== 'string' ||
		typeof body.invoiceId !== 'string' ||
		typeof body.to !== 'string' ||
		!isValidEmail(body.to)
	) {
		error(400, 'Bad request');
	}

	const result = await sendInvoiceEmail(body.therapistId, body.invoiceId, body.to);
	if (!result.ok) {
		if (result.reason === 'not_found') {
			return json(result, { status: 404 });
		}
		return json(result, { status: 409 });
	}
	return json(result);
};
