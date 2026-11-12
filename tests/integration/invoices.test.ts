import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, clientBilling, invoice, invoiceSettings, payment } from '$lib/server/db/schema';
import { draftFromPayment } from '$lib/server/invoiceDraft';
import { cancelInvoice, getInvoice, issueInvoice } from '$lib/server/invoices';
import type { InvoiceIssueEdits } from '$lib/invoiceValidation';
import { handleSessionInvoicePaid } from '$lib/server/sessionPayments';
import { isActionFailure } from '@sveltejs/kit';
import { actions as clientPageActions } from '../../src/routes/(app)/clients/[clientId]/+page.server';
import { resetDb, mkTherapist, mkClient, mkPayment, mkAppointment, mkEvent } from './helpers';

// Issuing GST invoices: numbering per financial year, one invoice per payment,
// ownership, and invoices outliving the client. See docs/invoice.md.

let therapistId: string;
let clientId: string;

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ currency: 'INR' })).id;
	clientId = (await mkClient(therapistId, { name: 'Sam Client' })).id;
});

async function mkInvoiceSettings(
	ownerId: string,
	overrides: Partial<typeof invoiceSettings.$inferInsert> = {}
) {
	await db.insert(invoiceSettings).values({
		therapistId: ownerId,
		address: '12 MG Road, Pune',
		stateCode: '27',
		gstin: '27AAPFU0939F1ZV',
		numberPrefix: 'ANV',
		...overrides
	});
}

function edits(amount: string, date = '2026-11-03'): InvoiceIssueEdits {
	return {
		date,
		taxType: 'auto',
		buyer: { name: 'Sam Client', address: '', gstin: '', stateCode: '27' },
		lines: [{ id: 'a', description: 'Therapy session', sacCode: '9993', amount, gstRate: '18' }]
	};
}

async function issue(date = '2026-11-03', owner = therapistId) {
	const paymentRow = await mkPayment(therapistId, clientId, { amount: 1180 });
	return issueInvoice(owner, paymentRow.id, edits('1180', date));
}

async function settingsRow() {
	const [row] = await db.select().from(invoiceSettings).where(eq(invoiceSettings.therapistId, therapistId));
	return row;
}

async function invoiceRow(id: string) {
	const [row] = await db.select().from(invoice).where(eq(invoice.id, id));
	return row;
}

describe('issueInvoice numbering', () => {
	beforeEach(async () => {
		await mkInvoiceSettings(therapistId);
	});

	it('issues 0001 and advances the series', async () => {
		const result = await issue();
		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		const row = await invoiceRow(result.invoiceId);
		expect(row.number).toBe('ANV/2026-27/0001');
		expect(row.taxType).toBe('cgst_sgst');
		expect(row.data.taxType).toBe('cgst_sgst');
		expect(row.data.number).toBe('ANV/2026-27/0001');
		expect(row.totalPaise).toBe(118000);
		expect(row.taxablePaise).toBe(100000);
		expect(row.taxPaise).toBe(18000);
		const settings = await settingsRow();
		expect(settings.nextNumber).toBe(2);
		expect(settings.nextNumberYear).toBe('2026-27');
	});

	it('uses an edited next number', async () => {
		await db.update(invoiceSettings).set({ nextNumber: 13 }).where(eq(invoiceSettings.therapistId, therapistId));
		const result = await issue();
		if (!result.ok) {
			throw new Error('expected ok');
		}
		expect((await invoiceRow(result.invoiceId)).number).toBe('ANV/2026-27/0013');
	});

	it('restarts at 0001 in a new financial year', async () => {
		await db
			.update(invoiceSettings)
			.set({ nextNumber: 40, nextNumberYear: '2025-26' })
			.where(eq(invoiceSettings.therapistId, therapistId));
		const result = await issue();
		if (!result.ok) {
			throw new Error('expected ok');
		}
		expect((await invoiceRow(result.invoiceId)).number).toBe('ANV/2026-27/0001');
		expect((await settingsRow()).nextNumber).toBe(2);
	});

	it('back-dating continues the earlier year and leaves the series alone', async () => {
		await db
			.update(invoiceSettings)
			.set({ nextNumber: 7, nextNumberYear: '2025-26' })
			.where(eq(invoiceSettings.therapistId, therapistId));
		await issue('2026-03-10');
		await issue('2026-05-01');
		const backDated = await issue('2026-03-20');
		if (!backDated.ok) {
			throw new Error('expected ok');
		}
		expect((await invoiceRow(backDated.invoiceId)).number).toBe('ANV/2025-26/0008');
		const settings = await settingsRow();
		expect(settings.nextNumber).toBe(2);
		expect(settings.nextNumberYear).toBe('2026-27');
	});

	it('refuses a number that is already used', async () => {
		await issue();
		await db.update(invoiceSettings).set({ nextNumber: 1 }).where(eq(invoiceSettings.therapistId, therapistId));
		const result = await issue();
		expect(result).toMatchObject({ ok: false, reason: 'invalid' });
		if (!result.ok && result.reason === 'invalid') {
			expect(result.message).toContain('already used');
		}
	});

	it('gives concurrent issues different numbers', async () => {
		const results = await Promise.all([issue(), issue(), issue()]);
		const numbers: string[] = [];
		for (const result of results) {
			if (!result.ok) {
				throw new Error('expected ok');
			}
			numbers.push((await invoiceRow(result.invoiceId)).number);
		}
		numbers.sort();
		expect(numbers).toEqual(['ANV/2026-27/0001', 'ANV/2026-27/0002', 'ANV/2026-27/0003']);
	});

	it('refuses a number longer than 16 characters', async () => {
		await db.update(invoiceSettings).set({ nextNumber: 10000 }).where(eq(invoiceSettings.therapistId, therapistId));
		expect(await issue()).toMatchObject({ ok: false, reason: 'invalid' });
	});
});

describe('issueInvoice checks', () => {
	beforeEach(async () => {
		await mkInvoiceSettings(therapistId);
	});

	it('allows one invoice per payment', async () => {
		const paymentRow = await mkPayment(therapistId, clientId, { amount: 1180 });
		const first = await issueInvoice(therapistId, paymentRow.id, edits('1180'));
		const second = await issueInvoice(therapistId, paymentRow.id, edits('1180'));
		if (!first.ok) {
			throw new Error('expected ok');
		}
		expect(second).toEqual({ ok: false, reason: 'already_issued', invoiceId: first.invoiceId });
	});

	it('requires the lines to add up to the payment', async () => {
		const paymentRow = await mkPayment(therapistId, clientId, { amount: 1180 });
		expect(await issueInvoice(therapistId, paymentRow.id, edits('1000'))).toMatchObject({
			ok: false,
			field: 'lines'
		});
	});

	it('from ₹50,000 an unregistered buyer needs address and state', async () => {
		const paymentRow = await mkPayment(therapistId, clientId, { amount: 50000 });
		expect(await issueInvoice(therapistId, paymentRow.id, edits('50000'))).toMatchObject({
			ok: false,
			field: 'buyer'
		});
	});

	it('refuses without invoice settings', async () => {
		const other = (await mkTherapist({ currency: 'INR' })).id;
		const otherClient = (await mkClient(other)).id;
		const paymentRow = await mkPayment(other, otherClient, { amount: 1180 });
		expect(await issueInvoice(other, paymentRow.id, edits('1180'))).toEqual({
			ok: false,
			reason: 'needs_settings'
		});
	});
});

describe('ownership', () => {
	it('another therapist cannot issue, read or cancel', async () => {
		await mkInvoiceSettings(therapistId);
		const other = (await mkTherapist({ currency: 'INR' })).id;
		await mkInvoiceSettings(other);

		const paymentRow = await mkPayment(therapistId, clientId, { amount: 1180 });
		expect(await issueInvoice(other, paymentRow.id, edits('1180'))).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect(await draftFromPayment(other, paymentRow.id, '2026-11-03')).toEqual({ kind: 'not_found' });

		const mine = await issueInvoice(therapistId, paymentRow.id, edits('1180'));
		if (!mine.ok) {
			throw new Error('expected ok');
		}
		expect(await getInvoice(other, mine.invoiceId)).toBeNull();
		expect(await cancelInvoice(other, mine.invoiceId)).toBe(false);
		expect((await invoiceRow(mine.invoiceId)).status).toBe('issued');

		expect(await cancelInvoice(therapistId, mine.invoiceId)).toBe(true);
		expect((await invoiceRow(mine.invoiceId)).status).toBe('cancelled');
		expect(await cancelInvoice(therapistId, mine.invoiceId)).toBe(false);
	});
});

describe('client deletion', () => {
	it('keeps the invoice and its snapshot', async () => {
		await mkInvoiceSettings(therapistId);
		const result = await issue();
		if (!result.ok) {
			throw new Error('expected ok');
		}
		await db.delete(client).where(eq(client.id, clientId));
		const row = await invoiceRow(result.invoiceId);
		expect(row.clientId).toBeNull();
		expect(row.paymentId).toBeNull();
		expect(row.data.buyer.name).toBe('Sam Client');
	});
});

describe('draftFromPayment', () => {
	it('asks for settings first', async () => {
		const paymentRow = await mkPayment(therapistId, clientId);
		expect(await draftFromPayment(therapistId, paymentRow.id, '2026-11-03')).toEqual({
			kind: 'needs_settings'
		});
	});

	it('prefills a session line and the buyer from billing', async () => {
		await mkInvoiceSettings(therapistId, { defaultGstRate: 18 });
		await db.insert(clientBilling).values({
			clientId,
			companyName: 'Acme Pvt Ltd',
			gstin: '29AAPFU0939F1ZV',
			stateCode: '29',
			gstRate: 5
		});
		const session = await mkAppointment(therapistId, clientId, {
			startAt: new Date('2026-10-12T10:30:00Z')
		});
		const paymentRow = await mkPayment(therapistId, clientId, {
			amount: 1500,
			appointmentId: session.id
		});

		const result = await draftFromPayment(therapistId, paymentRow.id, '2026-11-03');
		if (result.kind !== 'draft') {
			throw new Error('expected a draft');
		}
		expect(result.draft.buyer.name).toBe('Acme Pvt Ltd');
		expect(result.draft.buyer.stateCode).toBe('29');
		expect(result.draft.lines[0].amount).toBe('1500');
		expect(result.draft.lines[0].gstRate).toBe('5');
		expect(result.draft.lines[0].description).toBe('Therapy session — 12 Oct 2026, 4:00 pm');
	});

	it('describes a cancellation fee', async () => {
		await mkInvoiceSettings(therapistId);
		const session = await mkAppointment(therapistId, clientId, {
			startAt: new Date('2026-10-12T10:30:00Z'),
			status: 'cancelled'
		});
		const paymentRow = await mkPayment(therapistId, clientId, { appointmentId: session.id });
		const result = await draftFromPayment(therapistId, paymentRow.id, '2026-11-03');
		if (result.kind !== 'draft') {
			throw new Error('expected a draft');
		}
		expect(result.draft.lines[0].description).toBe('Cancellation fee — session of 12 Oct 2026, 4:00 pm');
	});
});

describe('autoIssueInvoice', () => {
	beforeEach(async () => {
		await mkInvoiceSettings(therapistId);
	});

	function markPaid(paymentId: string) {
		const event = mkEvent({
			locals: { therapistId },
			params: { clientId },
			fields: { paymentId }
		});
		return clientPageActions.markPaid(event as never);
	}

	async function invoicesFor(paymentId: string) {
		return db.select().from(invoice).where(eq(invoice.paymentId, paymentId));
	}

	async function turnOn() {
		await db.insert(clientBilling).values({ clientId, autoInvoice: true });
	}

	it('is off by default: marking paid issues nothing', async () => {
		const paymentRow = await mkPayment(therapistId, clientId, { amount: 1180 });
		await markPaid(paymentRow.id);
		expect(await invoicesFor(paymentRow.id)).toHaveLength(0);
	});

	it('issues one invoice on mark paid, and none more on a repeat', async () => {
		await turnOn();
		const paymentRow = await mkPayment(therapistId, clientId, { amount: 1180 });
		await markPaid(paymentRow.id);
		await markPaid(paymentRow.id);
		const rows = await invoicesFor(paymentRow.id);
		expect(rows).toHaveLength(1);
		expect(rows[0].number).toBe('ANV/2026-27/0001');
		expect(rows[0].totalPaise).toBe(118000);
	});

	it('issues on a Razorpay capture, once across replays', async () => {
		await turnOn();
		const paymentRow = await mkPayment(therapistId, clientId, {
			amount: 1180,
			razorpayOrderId: 'order_AUTO'
		});
		const capture = { orderId: 'order_AUTO', razorpayPaymentId: 'pay_1', amountMinor: 118000 };
		await handleSessionInvoicePaid(capture);
		await handleSessionInvoicePaid(capture);
		expect(await invoicesFor(paymentRow.id)).toHaveLength(1);
	});

	it('a refused issue still leaves the payment paid', async () => {
		await turnOn();
		await db
			.update(invoiceSettings)
			.set({ numberPrefix: 'MUCH-TOO-LONG-PREFIX' })
			.where(eq(invoiceSettings.therapistId, therapistId));
		const paymentRow = await mkPayment(therapistId, clientId, { amount: 1180 });
		const result = await markPaid(paymentRow.id);
		expect(isActionFailure(result)).toBe(false);
		const [paid] = await db.select().from(payment).where(eq(payment.id, paymentRow.id));
		expect(paid.status).toBe('paid');
		expect(await invoicesFor(paymentRow.id)).toHaveLength(0);
	});
});
