import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoiceSettings, therapist } from '$lib/server/db/schema';
import type { InvoiceSettingsInput } from '$lib/invoiceValidation';

export type InvoiceSettingsRow = typeof invoiceSettings.$inferSelect;

// GST invoices are India-only (docs/invoice.md).
export async function isInrTherapist(therapistId: string): Promise<boolean> {
	const [row] = await db
		.select({ currency: therapist.currency })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	if (!row) {
		return false;
	}
	return row.currency === 'INR';
}

// null until the therapist saves the form for the first time
export async function getInvoiceSettings(therapistId: string): Promise<InvoiceSettingsRow | null> {
	const [row] = await db
		.select()
		.from(invoiceSettings)
		.where(eq(invoiceSettings.therapistId, therapistId));
	if (!row) {
		return null;
	}
	return row;
}

export type InvoiceImageKeys = {
	logoKey: string | null;
	signatureKey: string | null;
};

// Insert on first save, update after. Keyed by therapistId, so it only ever
// touches the caller's own row. nextNumberYear is left alone — issuing owns it.
export async function saveInvoiceSettings(
	therapistId: string,
	input: InvoiceSettingsInput,
	images: InvoiceImageKeys
): Promise<void> {
	const values = {
		legalName: input.legalName,
		address: input.address,
		stateCode: input.stateCode,
		gstin: input.gstin,
		sacCode: input.sacCode,
		defaultGstRate: input.defaultGstRate,
		numberPrefix: input.numberPrefix,
		nextNumber: input.nextNumber,
		footer: input.footer,
		extraFields: input.extraFields,
		logoKey: images.logoKey,
		signatureKey: images.signatureKey
	};
	await db
		.insert(invoiceSettings)
		.values({ therapistId, ...values })
		.onConflictDoUpdate({ target: invoiceSettings.therapistId, set: values });
}
