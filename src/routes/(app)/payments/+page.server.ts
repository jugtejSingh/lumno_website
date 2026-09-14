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

const BALANCES_PER_PAGE = 15;

const PAYMENT_NOT_FOUND = 'That payment could not be found — it may have been deleted. Refresh and try again.';

function parseAmount(raw: FormDataEntryValue | null): number | null {
	const amount = Number(raw);
	if (!Number.isFinite(amount) || amount < 1) {
		return null;
	}
	return amount;
}

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const now = new Date();
	const balancesPage = Math.max(1, Number(event.url.searchParams.get('balancesPage')) || 1);

	const [summary, balances, clients] = await Promise.all([
		getMonthlyPaymentSummary(therapist.id, now.getFullYear(), now.getMonth()),
		listOutstandingBalancesByClient(therapist.id),
		listClients(therapist.id)
	]);

	return {
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
			return fail(400, { message: 'Enter an amount greater than 0' });
		}

		await addCharge(therapistId, { ...(customName ? { customName } : { clientId }), amount, note });
	},

	updatePayment: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const paymentId = formData.get('paymentId')?.toString() ?? '';
		const amount = parseAmount(formData.get('amount'));
		const note = formData.get('note')?.toString().trim() || null;

		if (amount === null) {
			return fail(400, { message: 'Enter an amount greater than 0' });
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
	}
};