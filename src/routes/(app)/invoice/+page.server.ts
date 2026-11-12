import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { todayInTimezone } from '$lib/invoice';
import { parseInvoiceIssueEdits } from '$lib/invoiceValidation';
import { draftFromPayment } from '$lib/server/invoiceDraft';
import { issueInvoice } from '$lib/server/invoices';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { therapist } = await parent();
	if (therapist.currency !== 'INR') {
		redirect(303, '/payments');
	}
	const paymentId = url.searchParams.get('payment');
	if (!paymentId) {
		redirect(303, '/invoices');
	}

	const result = await draftFromPayment(
		locals.therapistId!,
		paymentId,
		todayInTimezone(therapist.timezone)
	);
	if (result.kind === 'not_found') {
		error(404, 'Payment not found');
	}
	if (result.kind === 'issued') {
		redirect(303, `/invoice/${result.invoiceId}`);
	}
	if (result.kind === 'needs_settings') {
		return { needsSettings: true as const };
	}
	return {
		needsSettings: false as const,
		draft: result.draft,
		paymentId: result.paymentId,
		amount: result.amount
	};
};

export const actions: Actions = {
	issue: async ({ request, locals }) => {
		const therapistId = locals.therapistId!;
		const owner = locals.therapist!;
		if (owner.currency !== 'INR') {
			return fail(403, { field: '', message: 'Invoices are only available for INR practices' });
		}
		const form = await request.formData();
		const paymentId = String(form.get('paymentId') ?? '');
		const parsed = parseInvoiceIssueEdits(
			String(form.get('invoice') ?? ''),
			todayInTimezone(owner.timezone)
		);
		if ('field' in parsed) {
			return fail(400, parsed);
		}

		const result = await issueInvoice(therapistId, paymentId, parsed.edits);
		if (result.ok) {
			redirect(303, `/invoice/${result.invoiceId}`);
		}
		if (result.reason === 'already_issued') {
			redirect(303, `/invoice/${result.invoiceId}`);
		}
		if (result.reason === 'not_found') {
			return fail(404, { field: '', message: 'That payment could not be found — it may have been deleted.' });
		}
		if (result.reason === 'needs_settings') {
			return fail(400, { field: '', message: 'Save your invoice settings first' });
		}
		return fail(400, { field: result.field, message: result.message });
	}
};
