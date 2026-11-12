import { and, count, desc, eq, max, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	clientBilling,
	invoice,
	invoiceSettings,
	payment,
	therapist,
	user
} from '$lib/server/db/schema';
import {
	computeInvoice,
	financialYearOf,
	formatInvoiceNumber,
	todayInTimezone,
	type InvoiceDraft
} from '$lib/invoice';
import type { InvoiceIssueEdits } from '$lib/invoiceValidation';
import { draftFromPayment, sellerParty } from '$lib/server/invoiceDraft';
import { logError } from '$lib/server/log';
import { signedUrl } from '$lib/server/storage';

// Issuing, listing and cancelling GST invoices. Issued rows are never deleted
// or edited, only cancelled — see docs/invoice.md.

export type InvoiceRow = typeof invoice.$inferSelect;

// GST caps an invoice number at 16 characters.
const MAX_NUMBER_LENGTH = 16;
// ₹50,000 in paise: above this an unregistered buyer needs name, address and state
const UNREGISTERED_DETAILS_THRESHOLD_PAISE = 5_000_000;

export type IssueResult =
	| { ok: true; invoiceId: string }
	| { ok: false; reason: 'not_found' }
	| { ok: false; reason: 'needs_settings' }
	| { ok: false; reason: 'already_issued'; invoiceId: string }
	| { ok: false; reason: 'invalid'; field: string; message: string };

// drizzle wraps the postgres error; the constraint name is on it or its cause
function uniqueViolationConstraint(err: unknown): string | null {
	const candidates: unknown[] = [err];
	if (err instanceof Error) {
		candidates.push(err.cause);
	}
	for (const candidate of candidates) {
		if (
			candidate instanceof Error &&
			'code' in candidate &&
			candidate.code === '23505' &&
			'constraint_name' in candidate
		) {
			return String(candidate.constraint_name);
		}
	}
	return null;
}

class IssueRefused extends Error {
	constructor(readonly result: IssueResult) {
		super('invoice issue refused');
	}
}

// One transaction with the therapist's invoice_settings row locked, so two
// issues at once queue up and get different numbers.
export async function issueInvoice(
	therapistId: string,
	paymentId: string,
	edits: InvoiceIssueEdits
): Promise<IssueResult> {
	try {
		return await db.transaction(async (tx) => {
			const [settings] = await tx
				.select()
				.from(invoiceSettings)
				.where(eq(invoiceSettings.therapistId, therapistId))
				.for('update');
			if (!settings) {
				throw new IssueRefused({ ok: false, reason: 'needs_settings' });
			}

			const [paymentRow] = await tx
				.select()
				.from(payment)
				.where(and(eq(payment.id, paymentId), eq(payment.therapistId, therapistId)));
			if (!paymentRow) {
				throw new IssueRefused({ ok: false, reason: 'not_found' });
			}

			const [existing] = await tx
				.select({ id: invoice.id })
				.from(invoice)
				.where(eq(invoice.paymentId, paymentId));
			if (existing) {
				throw new IssueRefused({ ok: false, reason: 'already_issued', invoiceId: existing.id });
			}

			const [owner] = await tx
				.select({ name: user.name })
				.from(therapist)
				.innerJoin(user, eq(therapist.userId, user.id))
				.where(eq(therapist.id, therapistId));

			// buyer extra fields (PAN, PO…) are the client's saved ones, not editable here
			let buyerExtraFields: InvoiceDraft['buyer']['extraFields'] = [];
			if (paymentRow.clientId) {
				const [billing] = await tx
					.select({ extraFields: clientBilling.extraFields })
					.from(clientBilling)
					.where(eq(clientBilling.clientId, paymentRow.clientId));
				if (billing) {
					buyerExtraFields = billing.extraFields;
				}
			}

			const draft: InvoiceDraft = {
				number: '',
				date: edits.date,
				taxType: edits.taxType,
				seller: sellerParty(settings, owner.name),
				buyer: { ...edits.buyer, extraFields: buyerExtraFields },
				lines: edits.lines,
				footer: settings.footer ?? ''
			};
			const computed = computeInvoice(draft);

			if (computed.totalPaise !== paymentRow.amount * 100) {
				throw new IssueRefused({
					ok: false,
					reason: 'invalid',
					field: 'lines',
					message: `The lines must add up to the payment, ${paymentRow.amount}`
				});
			}
			if (computed.totalPaise >= UNREGISTERED_DETAILS_THRESHOLD_PAISE && draft.buyer.gstin === '') {
				if (draft.buyer.address === '' || draft.buyer.stateCode === '') {
					throw new IssueRefused({
						ok: false,
						reason: 'invalid',
						field: 'buyer',
						message: "From ₹50,000 a buyer without a GSTIN needs their address and state"
					});
				}
			}

			// numbering — docs/invoice.md "Invoice numbers"
			const financialYear = financialYearOf(draft.date);
			let sequence: number;
			let advanceSeries = true;
			if (settings.nextNumberYear === null || settings.nextNumberYear === financialYear) {
				sequence = settings.nextNumber;
			} else if (financialYear > settings.nextNumberYear) {
				sequence = 1;
			} else {
				// back-dated into an earlier year: continue that year, leave the current series alone
				const [highest] = await tx
					.select({ value: max(invoice.sequence) })
					.from(invoice)
					.where(and(eq(invoice.therapistId, therapistId), eq(invoice.financialYear, financialYear)));
				sequence = (highest?.value ?? 0) + 1;
				advanceSeries = false;
			}

			const number = formatInvoiceNumber(settings.numberPrefix, financialYear, sequence);
			if (number.length > MAX_NUMBER_LENGTH) {
				throw new IssueRefused({
					ok: false,
					reason: 'invalid',
					field: '',
					message: `${number} is longer than GST's 16 characters — shorten your prefix in invoice settings`
				});
			}

			// the snapshot keeps the resolved type, never 'auto'
			draft.number = number;
			draft.taxType = computed.taxType;

			const [created] = await tx
				.insert(invoice)
				.values({
					therapistId,
					paymentId,
					clientId: paymentRow.clientId,
					financialYear,
					sequence,
					number,
					issueDate: draft.date,
					taxType: computed.taxType,
					data: draft,
					logoKey: settings.logoKey,
					signatureKey: settings.signatureKey,
					taxablePaise: computed.taxablePaise,
					taxPaise: computed.totalPaise - computed.taxablePaise,
					totalPaise: computed.totalPaise
				})
				.returning({ id: invoice.id });

			if (advanceSeries) {
				await tx
					.update(invoiceSettings)
					.set({ nextNumber: sequence + 1, nextNumberYear: financialYear })
					.where(eq(invoiceSettings.therapistId, therapistId));
			}

			return { ok: true as const, invoiceId: created.id };
		});
	} catch (err) {
		if (err instanceof IssueRefused) {
			return err.result;
		}
		const constraint = uniqueViolationConstraint(err);
		if (constraint === 'invoice_therapistId_year_sequence_uidx') {
			return {
				ok: false,
				reason: 'invalid',
				field: '',
				message:
					'That invoice number is already used — raise "Next invoice number" in invoice settings'
			};
		}
		if (constraint === 'invoice_payment_id_unique') {
			const [existing] = await db
				.select({ id: invoice.id })
				.from(invoice)
				.where(eq(invoice.paymentId, paymentId));
			if (existing) {
				return { ok: false, reason: 'already_issued', invoiceId: existing.id };
			}
		}
		throw err;
	}
}

export async function getInvoice(therapistId: string, invoiceId: string): Promise<InvoiceRow | null> {
	const [row] = await db
		.select()
		.from(invoice)
		.where(and(eq(invoice.id, invoiceId), eq(invoice.therapistId, therapistId)));
	if (!row) {
		return null;
	}
	return row;
}

export type InvoiceListRow = {
	id: string;
	number: string;
	issueDate: string;
	buyerName: string;
	totalPaise: number;
	status: InvoiceRow['status'];
};

export async function listInvoices(
	therapistId: string,
	page: number,
	pageSize: number
): Promise<{ rows: InvoiceListRow[]; total: number }> {
	const [found, [countRow]] = await Promise.all([
		db
			.select({
				id: invoice.id,
				number: invoice.number,
				issueDate: invoice.issueDate,
				data: invoice.data,
				totalPaise: invoice.totalPaise,
				status: invoice.status
			})
			.from(invoice)
			.where(eq(invoice.therapistId, therapistId))
			.orderBy(desc(invoice.issueDate), desc(invoice.financialYear), desc(invoice.sequence))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db.select({ value: count() }).from(invoice).where(eq(invoice.therapistId, therapistId))
	]);

	const rows: InvoiceListRow[] = [];
	for (const row of found) {
		rows.push({
			id: row.id,
			number: row.number,
			issueDate: row.issueDate,
			buyerName: row.data.buyer.name,
			totalPaise: row.totalPaise,
			status: row.status
		});
	}
	return { rows, total: countRow?.value ?? 0 };
}

// Only flips the status; the row and its number stay as GST records.
export async function cancelInvoice(therapistId: string, invoiceId: string): Promise<boolean> {
	const rows = await db
		.update(invoice)
		.set({ status: 'cancelled' })
		.where(
			and(
				eq(invoice.id, invoiceId),
				eq(invoice.therapistId, therapistId),
				eq(invoice.status, 'issued')
			)
		)
		.returning({ id: invoice.id });
	return rows.length > 0;
}

// Called after a payment is marked paid (by hand, a paid charge, or a Razorpay
// capture). Issues the invoice only if the therapist turned auto_invoice on for
// this client and has invoice settings. Never throws: a failure is logged and
// the payment stays paid — the therapist can still issue it by hand.
// Invoices are only ever sent by email (step 6), never WhatsApp.
export async function autoIssueInvoice(therapistId: string, paymentId: string): Promise<void> {
	try {
		const [row] = await db
			.select({
				autoInvoice: clientBilling.autoInvoice,
				currency: therapist.currency,
				timezone: therapist.timezone
			})
			.from(payment)
			.innerJoin(therapist, eq(payment.therapistId, therapist.id))
			.innerJoin(clientBilling, eq(clientBilling.clientId, payment.clientId))
			.where(and(eq(payment.id, paymentId), eq(payment.therapistId, therapistId)));
		if (!row || !row.autoInvoice || row.currency !== 'INR') {
			return;
		}

		const today = todayInTimezone(row.timezone);
		const drafted = await draftFromPayment(therapistId, paymentId, today);
		if (drafted.kind !== 'draft') {
			return;
		}

		const draft = drafted.draft;
		const result = await issueInvoice(therapistId, paymentId, {
			date: draft.date,
			taxType: draft.taxType,
			buyer: {
				name: draft.buyer.name,
				address: draft.buyer.address,
				gstin: draft.buyer.gstin,
				stateCode: draft.buyer.stateCode
			},
			lines: draft.lines
		});
		if (!result.ok && result.reason !== 'already_issued') {
			logError('autoIssueInvoice', new Error(`auto invoice refused: ${result.reason}`), {
				therapistId,
				paymentId,
				result
			});
		}
	} catch (err) {
		logError('autoIssueInvoice', err, { therapistId, paymentId });
	}
}

// Settings use this before deleting a replaced logo/signature: an issued
// invoice keeps the image it was issued with, for as long as the invoice is kept.
export async function isImageKeyOnAnInvoice(key: string): Promise<boolean> {
	const [row] = await db
		.select({ id: invoice.id })
		.from(invoice)
		.where(or(eq(invoice.logoKey, key), eq(invoice.signatureKey, key)))
		.limit(1);
	if (row) {
		return true;
	}
	return false;
}

export type InvoiceImageUrls = { logoUrl: string | null; signatureUrl: string | null };

export async function invoiceImageUrls(row: InvoiceRow): Promise<InvoiceImageUrls> {
	let logoUrl: string | null = null;
	if (row.logoKey) {
		logoUrl = await signedUrl(row.logoKey);
	}
	let signatureUrl: string | null = null;
	if (row.signatureKey) {
		signatureUrl = await signedUrl(row.signatureKey);
	}
	return { logoUrl, signatureUrl };
}

// Portal: a client sees only invoices made out to them (invoice.client_id).
// One-off customName invoices have no client, so they never show here.
export async function getClientInvoice(clientId: string, invoiceId: string): Promise<InvoiceRow | null> {
	const [row] = await db
		.select()
		.from(invoice)
		.where(and(eq(invoice.id, invoiceId), eq(invoice.clientId, clientId)));
	if (!row) {
		return null;
	}
	return row;
}

// ponytail: unpaginated — one client's invoices; paginate like listInvoices if that ever grows
export async function listClientInvoices(clientId: string): Promise<InvoiceListRow[]> {
	const found = await db
		.select({
			id: invoice.id,
			number: invoice.number,
			issueDate: invoice.issueDate,
			data: invoice.data,
			totalPaise: invoice.totalPaise,
			status: invoice.status
		})
		.from(invoice)
		.where(eq(invoice.clientId, clientId))
		.orderBy(desc(invoice.issueDate), desc(invoice.financialYear), desc(invoice.sequence));

	const rows: InvoiceListRow[] = [];
	for (const row of found) {
		rows.push({
			id: row.id,
			number: row.number,
			issueDate: row.issueDate,
			buyerName: row.data.buyer.name,
			totalPaise: row.totalPaise,
			status: row.status
		});
	}
	return rows;
}
