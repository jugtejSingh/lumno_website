import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listInvoices } from '$lib/server/invoices';

const INVOICES_PER_PAGE = 20;

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { therapist } = await parent();
	if (therapist.currency !== 'INR') {
		redirect(303, '/payments');
	}
	let page = Number(url.searchParams.get('page'));
	if (!Number.isInteger(page) || page < 1) {
		page = 1;
	}
	const { rows, total } = await listInvoices(locals.therapistId!, page, INVOICES_PER_PAGE);
	return {
		invoices: rows,
		page,
		totalPages: Math.max(1, Math.ceil(total / INVOICES_PER_PAGE))
	};
};
