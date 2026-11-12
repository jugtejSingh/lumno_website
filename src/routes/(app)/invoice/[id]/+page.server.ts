import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { cancelInvoice, getInvoice, invoiceImageUrls } from '$lib/server/invoices';
import { invoiceRecipient } from '$lib/server/clientBilling';
import { invoiceEmailRatelimit } from '$lib/server/rateLimit';
import { requestInvoiceEmail } from '$lib/server/invoiceEmailRequest';
import { isValidEmail } from '$lib/isValidEmail';

export const load: PageServerLoad = async ({ locals, params }) => {
	const row = await getInvoice(locals.therapistId!, params.id);
	if (!row) {
		error(404, 'Invoice not found');
	}
	return {
		invoice: {
			id: row.id,
			number: row.number,
			status: row.status,
			data: row.data,
			sentTo: row.sentTo,
			sentAt: row.sentAt
		},
		images: await invoiceImageUrls(row),
		defaultRecipient: await invoiceRecipient(row.clientId)
	};
};

export const actions: Actions = {
	cancel: async ({ locals, params }) => {
		const cancelled = await cancelInvoice(locals.therapistId!, params.id);
		if (!cancelled) {
			return fail(404, { message: 'That invoice could not be cancelled — it may already be cancelled.' });
		}
		return { cancelled: true };
	},

	email: async ({ locals, params, request, url }) => {
		const form = await request.formData();
		const rawTo = form.get('to');
		let to = '';
		if (typeof rawTo === 'string') {
			to = rawTo.trim();
		}
		if (!isValidEmail(to)) {
			return fail(400, { emailError: 'Enter a valid email address', to });
		}

		const row = await getInvoice(locals.therapistId!, params.id);
		if (!row) {
			return fail(404, { emailError: 'Invoice not found', to });
		}
		if (row.status === 'cancelled') {
			return fail(409, { emailError: 'A cancelled invoice can’t be emailed', to });
		}

		const { success } = await invoiceEmailRatelimit.limit(row.id);
		if (!success) {
			return fail(429, {
				emailError: 'This invoice was emailed 3 times in the last hour. Try again later.',
				to
			});
		}

		const outcome = await requestInvoiceEmail(url.origin, {
			therapistId: locals.therapistId!,
			invoiceId: row.id,
			to
		});
		if (outcome === 'not_found') {
			return fail(404, { emailError: 'Invoice not found', to });
		}
		if (outcome === 'cancelled') {
			return fail(409, { emailError: 'A cancelled invoice can’t be emailed', to });
		}
		if (outcome === 'failed') {
			return fail(502, { emailError: 'The email could not be sent. Please try again.', to });
		}
		return { emailedTo: to };
	}
};
