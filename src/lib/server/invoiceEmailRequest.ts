import { env } from '$env/dynamic/private';
import { logError } from '$lib/server/log';

// Asks the separate invoice-email function to render and send. Kept apart from
// invoiceEmail.ts so callers never import Chromium. A real HTTP call (not
// event.fetch) so it runs in that function, not in-process.
// ponytail: preview deployments behind Vercel Deployment Protection will 401
// this call; add a protection-bypass header if previews need to send.

export type InvoiceEmailOutcome = 'sent' | 'not_found' | 'cancelled' | 'failed';

export async function requestInvoiceEmail(
	origin: string,
	input: { therapistId: string; invoiceId: string; to: string }
): Promise<InvoiceEmailOutcome> {
	try {
		const response = await fetch(`${origin}/api/internal/invoice-email`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${env.CRON_SECRET}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify(input)
		});
		if (response.ok) {
			return 'sent';
		}
		if (response.status === 404) {
			return 'not_found';
		}
		if (response.status === 409) {
			return 'cancelled';
		}
		logError('invoiceEmail.request', new Error(`invoice email failed with ${response.status}`));
		return 'failed';
	} catch (err) {
		logError('invoiceEmail.request', err);
		return 'failed';
	}
}
