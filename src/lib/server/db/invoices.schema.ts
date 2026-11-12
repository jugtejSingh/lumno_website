import { relations } from 'drizzle-orm';
import {
	pgTable,
	text,
	integer,
	boolean,
	date,
	timestamp,
	jsonb,
	pgEnum,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import type { InvoiceDraft } from '../../invoice';
// anything else a therapist or company wants printed (PAN, PO number…)
import type { InvoiceExtraField } from '../../invoiceValidation';
import { therapist, client } from './users.schema';
import { payment } from './payments.schema';

// GST invoices — see docs/invoice.md.

// what the therapist picked for a client; 'auto' is resolved at issue time
export const invoiceTaxTypeChoiceEnum = pgEnum('invoice_tax_type_choice', [
	'auto',
	'cgst_sgst',
	'igst',
	'none'
]);
// what an issued invoice actually is — never 'auto'. 'none' = Bill of Supply.
export const invoiceTaxTypeEnum = pgEnum('invoice_tax_type', ['cgst_sgst', 'igst', 'none']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['issued', 'cancelled']);

// The therapist's own invoice details, one row per therapist.
export const invoiceSettings = pgTable('invoice_settings', {
	therapistId: text('therapist_id')
		.primaryKey()
		.references(() => therapist.id, { onDelete: 'cascade' }),
	// null = fall back to user.name
	legalName: text('legal_name'),
	address: text('address').notNull(),
	// 2-digit GST state code, e.g. '27'
	stateCode: text('state_code').notNull(),
	// null = not GST registered, invoices are Bills of Supply
	gstin: text('gstin'),
	sacCode: text('sac_code').notNull().default('9993'),
	// whole percent
	defaultGstRate: integer('default_gst_rate').notNull().default(18),
	numberPrefix: text('number_prefix'),
	// editable so a therapist moving from another tool can continue their series
	nextNumber: integer('next_number').notNull().default(1),
	// financial year nextNumber belongs to, e.g. '2026-27'; null = never issued
	nextNumberYear: text('next_number_year'),
	// bank/UPI details, terms, thank-you line
	footer: text('footer'),
	logoKey: text('logo_key'),
	signatureKey: text('signature_key'),
	extraFields: jsonb('extra_fields').$type<InvoiceExtraField[]>().notNull().default([]),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

// A client's billing details. Editable by the client (portal) or the therapist,
// except autoSend, which only the therapist can change.
export const clientBilling = pgTable('client_billing', {
	clientId: text('client_id')
		.primaryKey()
		.references(() => client.id, { onDelete: 'cascade' }),
	// null = fall back to client.name
	companyName: text('company_name'),
	// null = fall back to client.email
	billingEmail: text('billing_email'),
	address: text('address'),
	gstin: text('gstin'),
	stateCode: text('state_code'),
	taxType: invoiceTaxTypeChoiceEnum('tax_type').notNull().default('auto'),
	// null = invoiceSettings.defaultGstRate
	gstRate: integer('gst_rate'),
	extraFields: jsonb('extra_fields').$type<InvoiceExtraField[]>().notNull().default([]),
	// email this client's invoices automatically when a payment is paid
	autoSend: boolean('auto_send').notNull().default(false),
	// issue an invoice automatically when one of this client's payments is paid;
	// therapist-only, off unless turned on per client
	autoInvoice: boolean('auto_invoice').notNull().default(false),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

// One row per payment, kept permanently (GST records, ~6 years). Never deleted,
// only cancelled. `data` is the snapshot as issued, so later edits to settings,
// client details or the payment never change it.
export const invoice = pgTable(
	'invoice',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		// restrict: deleting a therapist must not wipe their GST records
		therapistId: text('therapist_id')
			.notNull()
			.references(() => therapist.id, { onDelete: 'restrict' }),
		// unique: one invoice per payment, and a retried webhook can't make a second.
		// set null: deleting a client cascades away their payments; the invoice stays.
		paymentId: text('payment_id')
			.unique()
			.references(() => payment.id, { onDelete: 'set null' }),
		// null for a one-off customName payment, or after the client is deleted
		clientId: text('client_id').references(() => client.id, { onDelete: 'set null' }),
		// e.g. '2026-27'
		financialYear: text('financial_year').notNull(),
		sequence: integer('sequence').notNull(),
		// stored as issued — the prefix may change later
		number: text('number').notNull(),
		issueDate: date('issue_date').notNull(),
		status: invoiceStatusEnum('status').notNull().default('issued'),
		// resolved at issue time, so a therapist registering for GST later can't
		// turn an old Bill of Supply into a Tax Invoice
		taxType: invoiceTaxTypeEnum('tax_type').notNull(),
		data: jsonb('data').$type<InvoiceDraft>().notNull(),
		// the settings images as issued; settings never delete a key an invoice uses
		logoKey: text('logo_key'),
		signatureKey: text('signature_key'),
		// for the list view; data is the source of truth
		taxablePaise: integer('taxable_paise').notNull(),
		taxPaise: integer('tax_paise').notNull(),
		totalPaise: integer('total_paise').notNull(),
		// last email; sentAt null = never sent
		sentTo: text('sent_to'),
		sentAt: timestamp('sent_at'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('invoice_therapistId_year_sequence_uidx').on(
			table.therapistId,
			table.financialYear,
			table.sequence
		),
		index('invoice_therapistId_issueDate_idx').on(table.therapistId, table.issueDate),
		index('invoice_clientId_idx').on(table.clientId)
	]
);

export const invoiceSettingsRelations = relations(invoiceSettings, ({ one }) => ({
	therapist: one(therapist, { fields: [invoiceSettings.therapistId], references: [therapist.id] })
}));

export const clientBillingRelations = relations(clientBilling, ({ one }) => ({
	client: one(client, { fields: [clientBilling.clientId], references: [client.id] })
}));

export const invoiceRelations = relations(invoice, ({ one }) => ({
	therapist: one(therapist, { fields: [invoice.therapistId], references: [therapist.id] }),
	client: one(client, { fields: [invoice.clientId], references: [client.id] }),
	payment: one(payment, { fields: [invoice.paymentId], references: [payment.id] })
}));
