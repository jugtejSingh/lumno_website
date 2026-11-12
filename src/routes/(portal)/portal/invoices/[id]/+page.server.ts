import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getClientInvoice, invoiceImageUrls } from '$lib/server/invoices';

export const load: PageServerLoad = async (event) => {
	const { client } = await event.parent();
	// scoped to invoice.client_id, so another client's id is simply not found
	const row = await getClientInvoice(client.id, event.params.id);
	if (!row) {
		error(404, 'Invoice not found');
	}
	return {
		invoice: {
			id: row.id,
			number: row.number,
			status: row.status,
			data: row.data
		},
		images: await invoiceImageUrls(row)
	};
};
