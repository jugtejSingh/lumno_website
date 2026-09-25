import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getMonthlyPaymentSummary,
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
import { listDoubleCharges, dismissDoubleCharge } from '$lib/server/sessionPayments';

const BALANCES_PER_PAGE = 15;

const PAYMENT_NOT_FOUND = 'That payment could not be found — it may have been deleted. Refresh and try again.';

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const now = new Date();
	const balancesPage = Math.max(1, Number(event.url.searchParams.get('balancesPage')) || 1);

	const [summary, balances, clients, doubleChargeRows, allPacks] = await Promise.all([
		getMonthlyPaymentSummary(therapist.id, now.getFullYear(), now.getMonth()),
		listOutstandingBalancesByClient(therapist.id),
		listClients(therapist.id),
		listDoubleCharges(therapist.id),
		listPacksForTherapist(therapist.id)
	]);

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

	const doubleCharges: { id: string; name: string; amount: number; date: string }[] = [];
	for (const row of doubleChargeRows) {
		let name = 'A client';
		if (row.clientName) {
			name = row.clientName;
		} else if (row.customName) {
			name = row.customName;
		}
		doubleCharges.push({
			id: row.id,
			name,
			amount: row.amount,
			date: row.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
		});
	}

	return {
		doubleCharges,
		packs,
		summary,
		balances: balances.slice((balancesPage - 1) * BALANCES_PER_PAGE, balancesPage * BALANCES_PER_PAGE),
		balancesPage,
		balancesTotal: balances.length,
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
		const amount = parseAmount(formData.get('amount'));
		const note = formData.get('note')?.toString().trim() || null;

		if (amount === null) {
			return fail(400, { message: 'Enter a whole number amount greater than 0' });
		}

		const found = await updatePayment(therapistId, paymentId, { amount, note });
		if (!found) {
			return fail(404, { message: PAYMENT_NOT_FOUND });
		}
	},

	deletePayment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const found = await deletePayment(therapistId, paymentId);
		if (!found) {
			return fail(404, { message: PAYMENT_NOT_FOUND });
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
	}
};