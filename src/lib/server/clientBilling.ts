import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, clientBilling, therapist } from '$lib/server/db/schema';
import type { ClientBillingDetailsInput, ClientBillingTaxInput } from '$lib/invoiceValidation';

export type ClientBillingRow = typeof clientBilling.$inferSelect;

// Callers check ownership first: the therapist via getClient(therapistId, clientId),
// the client via their own locals.clientId.

export async function getClientBilling(clientId: string): Promise<ClientBillingRow | null> {
	const [row] = await db.select().from(clientBilling).where(eq(clientBilling.clientId, clientId));
	if (!row) {
		return null;
	}
	return row;
}

// For the portal, which only knows the client.
export async function isInrClient(clientId: string): Promise<boolean> {
	const [row] = await db
		.select({ currency: therapist.currency })
		.from(client)
		.innerJoin(therapist, eq(client.therapistId, therapist.id))
		.where(eq(client.id, clientId));
	if (!row) {
		return false;
	}
	return row.currency === 'INR';
}

// Strings for the form drafts; blanks when the client has no billing row yet.
export function billingDraft(row: ClientBillingRow | null) {
	if (!row) {
		return {
			details: {
				companyName: '',
				billingEmail: '',
				address: '',
				gstin: '',
				stateCode: '',
				extraFields: [] as ClientBillingRow['extraFields']
			},
			taxType: 'auto' as ClientBillingRow['taxType'],
			gstRate: '',
			autoInvoice: false
		};
	}
	let gstRate = '';
	if (row.gstRate !== null) {
		gstRate = String(row.gstRate);
	}
	return {
		details: {
			companyName: row.companyName ?? '',
			billingEmail: row.billingEmail ?? '',
			address: row.address ?? '',
			gstin: row.gstin ?? '',
			stateCode: row.stateCode ?? '',
			extraFields: row.extraFields
		},
		taxType: row.taxType,
		gstRate,
		autoInvoice: row.autoInvoice
	};
}

// Upsert. `tax` is passed only by the therapist; a client's save leaves tax type,
// GST rate, auto_invoice and auto_send as they were.
export async function saveClientBilling(
	clientId: string,
	details: ClientBillingDetailsInput,
	tax?: ClientBillingTaxInput
): Promise<void> {
	let values: ClientBillingDetailsInput & Partial<ClientBillingTaxInput> = { ...details };
	if (tax) {
		values = { ...details, ...tax };
	}
	await db
		.insert(clientBilling)
		.values({ clientId, ...values })
		.onConflictDoUpdate({ target: clientBilling.clientId, set: values });
}

// Who an invoice email goes to by default: billing email, else the client's own
// email, else empty (one-off customName invoices have no client).
export async function invoiceRecipient(clientId: string | null): Promise<string> {
	if (!clientId) {
		return '';
	}
	const [row] = await db
		.select({ billingEmail: clientBilling.billingEmail, clientEmail: client.email })
		.from(client)
		.leftJoin(clientBilling, eq(clientBilling.clientId, client.id))
		.where(eq(client.id, clientId));
	if (!row) {
		return '';
	}
	if (row.billingEmail) {
		return row.billingEmail;
	}
	if (row.clientEmail) {
		return row.clientEmail;
	}
	return '';
}
