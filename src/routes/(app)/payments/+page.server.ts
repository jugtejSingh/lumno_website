import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getPaymentSummary,
	listOutstandingBalancesByClient,
	setPaymentStatus,
	addCharge,
	updatePayment,
	deletePayment,
	createPack,
	listPacksForTherapist,
	parseAmount
} from '$lib/server/payments';
import { listClients } from '$lib/server/clients';
import { parsePeriod, periodOptions } from '$lib/server/period';
import { listDoubleCharges, dismissDoubleCharge } from '$lib/server/sessionPayments';
import { recordManualRefund, refundViaRazorpay } from '$lib/server/paymentRefunds';

const BALANCES_PER_PAGE = 5;
const PACKS_PER_PAGE = 5;

const PAYMENT_NOT_FOUND = 'That payment could not be found — it may have been deleted. Refresh and try again.';
const PAID_NOT_DELETABLE = 'A paid or refunded payment can’t be deleted — it’s the record of money received.';
const PAID_NOT_REPRICEABLE = 'A paid payment’s amount can’t be changed — only its note.';

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const now = new Date();
	const balancesPage = Math.max(1, Number(event.url.searchParams.get('balancesPage')) || 1);
	const packsPage = Math.max(1, Number(event.url.searchParams.get('packsPage')) || 1);
	const period = parsePeriod(event.url.searchParams.get('period'), therapist.timezone, now);

	const [summary, balances, clients, doubleChargeRows, allPacks] = await Promise.all([
		getPaymentSummary(therapist.id, period.start, period.end),
		listOutstandingBalancesByClient(therapist.id),
		listClients(therapist.id),
		listDoubleCharges(therapist.id),
		listPacksForTherapist(therapist.id)
	]);

	// all-time total owed, across every page of the "Who owes you" list
	let balancesOwedTotal = 0;
	for (const balance of balances) {
		balancesOwedTotal += balance.owed;
	}

	// only packs with sessions still to use; what was paid for them is in the payment history
	const packs: {
		id: string;
		clientName: string;
		sessionCount: number;
		remaining: number;
	}[] = [];
	for (const pack of allPacks) {
		if (pack.status === 'active') {
			packs.push({
				id: pack.id,
				clientName: pack.clientName,
				sessionCount: pack.sessionCount,
				remaining: pack.remaining
			});
		}
	}

	const doubleCharges: {
		id: string;
		kind: 'already_paid' | 'cancel_refund';
		name: string;
		amount: number;
		date: string;
	}[] = [];
	for (const row of doubleChargeRows) {
		let name = 'A client';
		if (row.clientName) {
			name = row.clientName;
		} else if (row.customName) {
			name = row.customName;
		}
		let kind: 'already_paid' | 'cancel_refund' = 'already_paid';
		let amount = row.amount;
		if (row.kind === 'cancel_refund') {
			// detail holds the refund owed (paid − cancellation fee), not the full charge
			kind = 'cancel_refund';
			amount = Number(row.detail);
		}
		doubleCharges.push({
			id: row.id,
			kind,
			name,
			amount,
			date: row.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
		});
	}

	return {
		doubleCharges,
		packs: packs.slice((packsPage - 1) * PACKS_PER_PAGE, packsPage * PACKS_PER_PAGE),
		packsPage,
		packsTotal: packs.length,
		packsPerPage: PACKS_PER_PAGE,
		summary,
		period: { kind: period.kind, value: period.value, label: period.label, prev: period.prev, next: period.next },
		periodOptions: periodOptions(therapist.timezone, now),
		balances: balances.slice((balancesPage - 1) * BALANCES_PER_PAGE, balancesPage * BALANCES_PER_PAGE),
		balancesPage,
		balancesTotal: balances.length,
		balancesOwedTotal,
		balancesPerPage: BALANCES_PER_PAGE,
		currency: therapist.currency,
		clients: clients.map((c) => ({ id: c.id, name: c.name }))
	};
};

export const actions: Actions = {
	markPaid: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const found = await setPaymentStatus(therapistId, paymentId, 'paid');
		if (!found) {
			return fail(404, { message: PAYMENT_NOT_FOUND });
		}
	},

	addCharge: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const customName = formData.get('customName')?.toString().trim() ?? '';
		const amount = parseAmount(formData.get('amount'));
		const note = formData.get('note')?.toString().trim() || null;

		if (!customName && !clientId) {
			return fail(400, { message: 'Pick a client or enter a name' });
		}
		if (amount === null) {
			return fail(400, { message: 'Enter a whole number amount greater than 0' });
		}

		await addCharge(therapistId, { ...(customName ? { customName } : { clientId }), amount, note });
	},

	createPack: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const sessionCount = parseAmount(formData.get('sessionCount'));
		const amount = parseAmount(formData.get('amount'));
		const paid = formData.get('paid') === 'on';

		if (!clientId) {
			return fail(400, { message: 'Pick a client' });
		}
		if (sessionCount === null) {
			return fail(400, { message: 'Enter a whole number of sessions greater than 0' });
		}
		if (amount === null) {
			return fail(400, { message: 'Enter a whole number price greater than 0' });
		}

		const result = await createPack(therapistId, { clientId, sessionCount, amount, paid });
		if ('error' in result) {
			if (result.error === 'client_has_active_pack') {
				return fail(400, {
					message: `This client still has ${result.remaining} session(s) left on their current pack`
				});
			}
			return fail(404, { message: 'That client could not be found' });
		}
	},

	updatePayment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const note = formData.get('note')?.toString().trim() || null;

		// a paid row's form has no amount field: its note is the only thing left to edit
		const input: { amount?: number; note: string | null } = { note };
		if (formData.has('amount')) {
			const amount = parseAmount(formData.get('amount'));
			if (amount === null) {
				return fail(400, { message: 'Enter a whole number amount greater than 0' });
			}
			input.amount = amount;
		}

		const result = await updatePayment(therapistId, paymentId, input);
		if (result === 'not_found') {
			return fail(404, { message: PAYMENT_NOT_FOUND });
		}
		if (result === 'paid') {
			return fail(400, { message: PAID_NOT_REPRICEABLE });
		}
	},

	deletePayment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const result = await deletePayment(therapistId, paymentId);
		if (result === 'not_found') {
			return fail(404, { message: PAYMENT_NOT_FOUND });
		}
		if (result === 'paid') {
			return fail(400, { message: PAID_NOT_DELETABLE });
		}
	},

	dismissDoubleCharge: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const exceptionId = formData.get('exceptionId')?.toString() ?? '';
		const found = await dismissDoubleCharge(therapistId, exceptionId);
		if (!found) {
			return fail(404, { message: 'That alert could not be found. Refresh and try again.' });
		}
	},

	refundRazorpay: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const amount = parseAmount(formData.get('amount'));
		if (amount === null) {
			return fail(400, { message: 'Enter the refund as a whole number of rupees.' });
		}
		const outcome = await refundViaRazorpay(therapistId, paymentId, amount);
		if (!outcome.ok) {
			return fail(400, { message: outcome.message });
		}
		return { refundStatus: outcome.status };
	},

	refundManual: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const amount = parseAmount(formData.get('amount'));
		if (amount === null) {
			return fail(400, { message: 'Enter the refund as a whole number of rupees.' });
		}
		const outcome = await recordManualRefund(therapistId, paymentId, amount);
		if (!outcome.ok) {
			return fail(400, { message: outcome.message });
		}
		return { refundStatus: outcome.status };
	}
};