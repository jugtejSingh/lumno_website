import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	appointment,
	client,
	clientBilling,
	invoice,
	invoiceSettings,
	payment,
	paymentPack,
	therapist,
	user
} from '$lib/server/db/schema';
import {
	GST_STATES,
	emptyParty,
	formatInvoiceDate,
	type InvoiceDraft, type InvoiceParty } from '$lib/invoice';

// Prefill for /invoice: an InvoiceDraft built from one payment, the therapist's
// invoice settings and the client's billing details. Read-only — issuing lives
// in invoices.ts. See docs/invoice.md ("Line descriptions").

type SettingsRow = typeof invoiceSettings.$inferSelect;

export type PaymentDraftResult =
	| { kind: 'not_found' }
	| { kind: 'needs_settings' }
	| { kind: 'issued'; invoiceId: string }
	| { kind: 'draft'; draft: InvoiceDraft; paymentId: string; amount: number };

// Also used by issueInvoice, so the seller on an issued invoice always comes
// from the saved settings, never from the browser.
export function sellerParty(settings: SettingsRow, accountName: string): InvoiceParty {
	return {
		name: settings.legalName ?? accountName,
		address: settings.address,
		gstin: settings.gstin ?? '',
		stateCode: settings.stateCode,
		extraFields: settings.extraFields
	};
}

// client.state is free text ("Maharashtra"); match it to a GST state code.
function stateCodeFromName(name: string | null): string {
	if (!name) {
		return '';
	}
	const wanted = name.trim().toLowerCase();
	for (const state of GST_STATES) {
		if (state.name.toLowerCase() === wanted) {
			return state.code;
		}
	}
	return '';
}

// "12 Oct 2026, 4:00 pm" in the therapist's timezone
function formatSessionTime(instant: Date, timezone: string): string {
	return new Intl.DateTimeFormat('en-IN', {
		timeZone: timezone,
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	}).format(instant);
}

type PaymentRow = typeof payment.$inferSelect;

async function describePayment(row: PaymentRow, timezone: string, today: string): Promise<string> {
	if (row.packId) {
		const [pack] = await db
			.select({ sessionCount: paymentPack.sessionCount })
			.from(paymentPack)
			.where(eq(paymentPack.id, row.packId));
		if (pack) {
			return `Session pack (${pack.sessionCount} sessions)`;
		}
	}

	if (!row.appointmentId) {
		if (row.note) {
			return row.note;
		}
		return `Charge — ${formatInvoiceDate(today)}`;
	}

	const [session] = await db
		.select({
			startAt: appointment.startAt,
			status: appointment.status,
			rescheduledFromId: appointment.rescheduledFromId
		})
		.from(appointment)
		.where(eq(appointment.id, row.appointmentId));
	if (!session) {
		return row.note ?? `Charge — ${formatInvoiceDate(today)}`;
	}
	const when = formatSessionTime(session.startAt, timezone);

	if (session.status === 'cancelled') {
		return `Cancellation fee — session of ${when}`;
	}

	const [first] = await db
		.select({ id: payment.id })
		.from(payment)
		.where(eq(payment.appointmentId, row.appointmentId))
		.orderBy(asc(payment.createdAt), asc(payment.id))
		.limit(1);
	if (first && first.id === row.id) {
		return `Therapy session — ${when}`;
	}

	// ponytail: any later charge on a moved session reads as a rescheduling fee
	// (docs/invoice.md); editable before issue.
	if (session.rescheduledFromId) {
		const [original] = await db
			.select({ startAt: appointment.startAt })
			.from(appointment)
			.where(eq(appointment.id, session.rescheduledFromId));
		if (original) {
			return `Rescheduling fee — session of ${formatSessionTime(original.startAt, timezone)}`;
		}
	}

	if (row.note) {
		return row.note;
	}
	return `Additional charge — session of ${when}`;
}

export async function draftFromPayment(
	therapistId: string,
	paymentId: string,
	today: string
): Promise<PaymentDraftResult> {
	const [row] = await db
		.select()
		.from(payment)
		.where(and(eq(payment.id, paymentId), eq(payment.therapistId, therapistId)));
	if (!row) {
		return { kind: 'not_found' };
	}

	const [existing] = await db
		.select({ id: invoice.id })
		.from(invoice)
		.where(eq(invoice.paymentId, paymentId));
	if (existing) {
		return { kind: 'issued', invoiceId: existing.id };
	}

	const [owner] = await db
		.select({ settings: invoiceSettings, accountName: user.name, timezone: therapist.timezone })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.leftJoin(invoiceSettings, eq(invoiceSettings.therapistId, therapist.id))
		.where(eq(therapist.id, therapistId));
	if (!owner || !owner.settings) {
		return { kind: 'needs_settings' };
	}
	const settings = owner.settings;

	const buyer = emptyParty();
	let taxType: InvoiceDraft['taxType'] = 'auto';
	let gstRate = settings.defaultGstRate;
	if (row.clientId) {
		const [buyerRow] = await db
			.select({ client, billing: clientBilling })
			.from(client)
			.leftJoin(clientBilling, eq(clientBilling.clientId, client.id))
			.where(eq(client.id, row.clientId));
		if (buyerRow) {
			const billing = buyerRow.billing;
			buyer.name = billing?.companyName ?? buyerRow.client.name;
			buyer.address = billing?.address ?? '';
			buyer.gstin = billing?.gstin ?? '';
			buyer.stateCode = billing?.stateCode ?? stateCodeFromName(buyerRow.client.state);
			if (billing) {
				buyer.extraFields = billing.extraFields;
				taxType = billing.taxType;
				if (billing.gstRate !== null) {
					gstRate = billing.gstRate;
				}
			}
		}
	} else if (row.customName) {
		buyer.name = row.customName;
	}

	const draft: InvoiceDraft = {
		number: '',
		date: today,
		taxType,
		seller: sellerParty(settings, owner.accountName),
		buyer,
		lines: [
			{
				id: crypto.randomUUID(),
				description: await describePayment(row, owner.timezone, today),
				sacCode: settings.sacCode,
				amount: String(row.amount),
				gstRate: String(gstRate)
			}
		],
		footer: settings.footer ?? ''
	};

	return { kind: 'draft', draft, paymentId: row.id, amount: row.amount };
}
