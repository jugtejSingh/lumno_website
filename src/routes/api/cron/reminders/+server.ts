import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { sendPaymentReminders, sendSessionReminders } from '$lib/server/reminderEmails';
import { refreshExpiringConnections } from '$lib/server/razorpayConnection';
import { sweepStaleOrders } from '$lib/server/sessionPayments';
import { logError } from '$lib/server/log';

const JOBS: Record<string, () => Promise<unknown>> = {
	sessionReminders: sendSessionReminders,
	paymentReminders: sendPaymentReminders,
	refreshConnections: refreshExpiringConnections,
	sweepStaleOrders: sweepStaleOrders
};

// Vercel Cron hits this on a schedule (see vercel.json) with the configured bearer secret.
// Each job runs in isolation: one crashing must not stop the others, and the
// response says which ones failed so the Vercel log has a clear signal.
export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
		error(401, 'Unauthorized');
	}

	const results: Record<string, 'ok' | 'failed'> = {};
	let allOk = true;
	for (const [name, run] of Object.entries(JOBS)) {
		try {
			await run();
			results[name] = 'ok';
		} catch (err) {
			logError(`cron.${name}`, err);
			results[name] = 'failed';
			allOk = false;
		}
	}

	return json({ ok: allOk, jobs: results }, { status: allOk ? 200 : 500 });
};
