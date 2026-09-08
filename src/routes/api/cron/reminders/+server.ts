import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { sendPaymentReminders, sendSessionReminders } from '$lib/server/reminderEmails';
import { refreshExpiringConnections } from '$lib/server/razorpayConnection';
import { sweepStaleOrders } from '$lib/server/sessionPayments';

// Vercel Cron hits this on a schedule (see vercel.json) with the configured bearer secret.
export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
		error(401, 'Unauthorized');
	}

	await sendSessionReminders();
	await sendPaymentReminders();
	await refreshExpiringConnections();
	await sweepStaleOrders();

	return json({ ok: true });
};
