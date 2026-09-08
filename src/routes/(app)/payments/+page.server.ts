import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getMonthlyPaymentSummary,
	listOutstandingBalancesByClient,
	setPaymentStatus,
	addCharge,
	updatePayment,
	deletePayment
} from '$lib/server/payments';
import { listClients } from '$lib/server/clients';

// "Who owes what" is a quick glance list, not the full roster — the client sidebar covers
// everyone, this only needs to surface the handful that actually need the therapist's attention.
const TOP_BALANCES_SHOWN = 5;

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const now = new Date();

	const [summary, balances, clients] = await Promise.all([
		getMonthlyPaymentSummary(therapist.id, now.getFullYear(), now.getMonth()),
		listOutstandingBalancesByClient(therapist.id),
		listClients(therapist.id)
	]);

	return {
		summary,
		balances: balances.slice(0, TOP_BALANCES_SHOWN),
		currency: therapist.currency,
		clients: clients.map((c) => ({ id: c.id, name: c.name }))
	};
};

export const actions: Actions = {
	markPaid: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		await setPaymentStatus(therapistId, paymentId, 'paid');
	},

	addCharge: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const customName = formData.get('customName')?.toString().trim() ?? '';
		const amount = Number(formData.get('amount'));
		const note = formData.get('note')?.toString().trim() || null;

		if (!customName && !clientId) {
			return fail(400, { message: 'Pick a client or enter a name' });
		}
		if (!amount || amount < 1) {
			return fail(400, { message: 'Enter an amount greater than 0' });
		}

		await addCharge(therapistId, { ...(customName ? { customName } : { clientId }), amount, note });
	},

	updatePayment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const amount = Number(formData.get('amount'));
		const note = formData.get('note')?.toString().trim() || null;

		if (!amount || amount < 1) {
			return fail(400, { message: 'Enter an amount greater than 0' });
		}

		await updatePayment(therapistId, paymentId, { amount, note });
	},

	deletePayment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		await deletePayment(therapistId, paymentId);
	}
};