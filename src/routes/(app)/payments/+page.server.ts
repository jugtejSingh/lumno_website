import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getMonthlyPaymentSummary,
	listOutstandingBalancesByClient,
	setPaymentStatus,
	listPacksForTherapist,
	createPack,
	updatePack,
	markPackPaid,
	cancelPack,
	addCharge,
	updatePayment,
	deletePayment
} from '$lib/server/payments';
import { getPaymentSettings, updatePaymentSettings } from '$lib/server/paymentSettings';
import { CHANGE_WINDOW_HOURS_OPTIONS, formatHours, type PackExhaustedAction } from '$lib/server/paymentPolicy';
import { addWalkInClient, listClients } from '$lib/server/clients';

const packExhaustedActionOptions: PackExhaustedAction[] = ['block_booking', 'require_single_payment'];
// "Who owes what" is a quick glance list, not the full roster — the client sidebar covers
// everyone, this only needs to surface the handful that actually need the therapist's attention.
const TOP_BALANCES_SHOWN = 5;

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const now = new Date();

	const [summary, balances, paymentSettings, packs, clients] = await Promise.all([
		getMonthlyPaymentSummary(therapist.id, now.getFullYear(), now.getMonth()),
		listOutstandingBalancesByClient(therapist.id),
		getPaymentSettings(therapist.id),
		listPacksForTherapist(therapist.id),
		listClients(therapist.id)
	]);

	return {
		summary,
		balances: balances.slice(0, TOP_BALANCES_SHOWN),
		currency: therapist.currency,
		paymentSettings,
		packExhaustedActionOptions,
		hourOptions: CHANGE_WINDOW_HOURS_OPTIONS.map((hours) => ({ hours, label: formatHours(hours) })),
		packs,
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
		let clientId = formData.get('clientId')?.toString() ?? '';
		const customName = formData.get('customName')?.toString().trim() ?? '';
		const amount = Number(formData.get('amount'));
		const note = formData.get('note')?.toString().trim() || null;

		if (customName) {
			const walkIn = await addWalkInClient(therapistId, customName);
			clientId = walkIn.id;
		}
		if (!clientId) {
			return fail(400, { message: 'Pick a client or enter a name' });
		}
		if (!amount || amount < 1) {
			return fail(400, { message: 'Enter an amount greater than 0' });
		}

		await addCharge(therapistId, { clientId, amount, note });
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
	},

	addPack: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const sessionCount = Number(formData.get('sessionCount'));
		const amount = Number(formData.get('amount'));

		if (!clientId || !sessionCount || sessionCount < 1 || !amount || amount < 1) {
			return fail(400, { message: 'Pick a client and enter a session count and amount greater than 0' });
		}

		await createPack(therapistId, { clientId, sessionCount, amount });
	},

	updatePack: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const packId = formData.get('packId')?.toString() ?? '';
		const sessionCount = Number(formData.get('sessionCount'));
		const amount = Number(formData.get('amount'));

		const result = await updatePack(therapistId, packId, { sessionCount, amount });
		if ('error' in result) {
			return fail(400, { message: 'Session count can’t go below sessions already used' });
		}
	},

	markPackPaid: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const packId = formData.get('packId')?.toString() ?? '';

		const result = await markPackPaid(therapistId, packId);
		if ('error' in result) {
			return fail(400, {
				message:
					result.error === 'client_has_active_pack'
						? `This client still has ${result.remaining} session(s) left on their current pack`
						: 'Pack not found'
			});
		}
	},

	cancelPack: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const packId = formData.get('packId')?.toString() ?? '';
		await cancelPack(therapistId, packId);
	},

	updatePaymentSettings: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const packsEnabled = formData.get('packsEnabled') === 'true';
		const packExhaustedAction = formData.get('packExhaustedAction')?.toString() as PackExhaustedAction;
		const freeChangeWindowHours = Number(formData.get('freeChangeWindowHours'));
		const partialRaw = formData.get('partialChangeWindowHours')?.toString() ?? '';
		const partialChangeWindowHours = partialRaw === '' ? null : Number(partialRaw);

		try {
			await updatePaymentSettings(therapistId, {
				packsEnabled,
				packExhaustedAction,
				freeChangeWindowHours,
				partialChangeWindowHours
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Invalid settings' });
		}
	}
};