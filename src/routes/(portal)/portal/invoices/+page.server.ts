import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listClientInvoices } from '$lib/server/invoices';

// The client's own invoices — view and download only (docs/invoice.md).
export const load: PageServerLoad = async (event) => {
	const { client, currency } = await event.parent();
	if (currency !== 'INR') {
		error(404, 'Not found');
	}
	return { invoices: await listClientInvoices(client.id) };
};
