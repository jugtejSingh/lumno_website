import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getBalanceDueForClient, listVisiblePaymentsForClient } from '$lib/server/payments';
import { getPaymentSettings, getManualPayDetails } from '$lib/server/paymentSettings';
import { signedUrl } from '$lib/server/storage';
import { connectionHealth } from '$lib/server/razorpayConnection';
import { startInvoiceCheckout } from '$lib/server/sessionPayments';
import { formatCurrency } from '$lib/format';

const PAGE_SIZE = 5;

export const load: PageServerLoad = async (event) => {
	const { client, currency } = await event.parent();

	const page = Math.max(1, Number(event.url.searchParams.get('page')) || 1);

	const [payments, balanceDue, paymentSettings, rzpHealth, manualPayRow] = await Promise.all([
		listVisiblePaymentsForClient(client.id, page, PAGE_SIZE),
		getBalanceDueForClient(client.id),
		getPaymentSettings(client.therapistId),
		connectionHealth(client.therapistId),
		getManualPayDetails(client.therapistId)
	]);

	// ponytail: gate on 'connected' per design §12.9. 'expiring' also has live
	// tokens but refreshExpiresAt is pushed 180d out on every refresh, so it
	// realistically never shows before the Phase 3 cron lands.
	const portalPayEnabled =
		currency === 'INR' && rzpHealth === 'connected' && paymentSettings.paymentMode === 'automatic';

	// Off-platform payment details. Shown whenever the therapist filled them in —
	// paying directly stays available alongside "Pay now" in automatic mode.
	let manualPay: { qrUrl: string | null; bankDetails: string | null } | null = null;
	if (manualPayRow.qrKey || manualPayRow.bankDetails) {
		let qrUrl: string | null = null;
		if (manualPayRow.qrKey) {
			qrUrl = await signedUrl(manualPayRow.qrKey);
		}
		manualPay = { qrUrl, bankDetails: manualPayRow.bankDetails };
	}

	const invoices = [];
	for (const p of payments.rows) {
		// a paid row is only listed because its session was cancelled and money is owed back
		let refund: { amount: string; done: boolean } | null = null;
		if (p.status === 'paid' && p.refundDue !== null) {
			refund = { amount: formatCurrency(p.refundDue, currency), done: p.refundedAt !== null };
		}
		invoices.push({
			id: p.id,
			// the session's date when the charge is for one, otherwise when it was charged
			date: (p.appointmentStartAt ?? p.createdAt).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric'
			}),
			amount: formatCurrency(p.amount, currency),
			note: p.note,
			payable: portalPayEnabled && p.status === 'unpaid',
			refund
		});
	}

	return {
		invoices,
		page,
		totalPages: Math.max(1, Math.ceil(payments.total / PAGE_SIZE)),
		balanceDue: formatCurrency(balanceDue, currency),
		hasBalanceDue: balanceDue > 0,
		manualPay
	};
};

export const actions: Actions = {
	payInvoice: async (event) => {
		if (!event.locals.clientId) {
			return fail(401);
		}
		const paymentId = (await event.request.formData()).get('paymentId')?.toString() ?? '';
		const result = await startInvoiceCheckout(event.locals.clientId, paymentId);
		if (!result.ok) {
			return fail(400, { message: result.message });
		}
		return {
			checkout: {
				orderId: result.orderId,
				key: result.key,
				amountMinor: result.amountMinor,
				therapistName: result.therapistName
			}
		};
	}
};
