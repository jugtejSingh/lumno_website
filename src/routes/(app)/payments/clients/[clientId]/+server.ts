import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClientPaymentTotals, listPaymentsForClientPage } from '$lib/server/payments';
import { listRefundsForTherapistPayments, type RefundSummary } from '$lib/server/paymentRefunds';

const PAGE_SIZE = 10;

// Backs the client payment-history view, reused by both the payments page's client-history
// modal and the /clients page's read-only history dialog. No separate ownership pre-check —
// like every other query in payments.ts, getClientPaymentTotals/listPaymentsForClientPage
// scope by (therapistId, clientId) directly, so a foreign or bogus clientId just comes back
// with zero rows/totals rather than another therapist's data.
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const therapistId = locals.therapistId!;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const [totals, history] = await Promise.all([
		getClientPaymentTotals(therapistId, params.clientId),
		listPaymentsForClientPage(therapistId, params.clientId, page, PAGE_SIZE)
	]);

	const paymentIds: string[] = [];
	for (const row of history.rows) {
		paymentIds.push(row.id);
	}
	// the page's payment ids came from a therapist-scoped query, so these refunds are theirs
	const refunds = await listRefundsForTherapistPayments(therapistId, paymentIds);

	const rows = [];
	for (const row of history.rows) {
		let refund: RefundSummary | null = null;
		const found = refunds.get(row.id);
		if (found) {
			refund = found;
		}
		rows.push({ ...row, refund });
	}

	return json({ totals, rows, total: history.total, page, pageSize: PAGE_SIZE });
};
