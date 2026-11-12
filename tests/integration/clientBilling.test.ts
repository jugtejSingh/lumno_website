import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { isActionFailure } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { clientBilling } from '$lib/server/db/schema';
import { actions as clientPageActions } from '../../src/routes/(app)/clients/[clientId]/+page.server';
import { actions as portalDetailsActions } from '../../src/routes/(portal)/portal/details/+page.server';
import { resetDb, mkTherapist, mkClient, mkEvent } from './helpers';

// Billing details: the therapist edits everything on their own clients; the client
// edits their own details but never tax type, GST rate, auto_send or auto_invoice.

let therapistId: string;
let clientId: string;

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ currency: 'INR' })).id;
	clientId = (await mkClient(therapistId, { name: 'Sam Client' })).id;
});

function asTherapist(fields: Record<string, string>, opts: { therapist?: string; client?: string } = {}) {
	const event = mkEvent({
		locals: { therapistId: opts.therapist ?? therapistId },
		params: { clientId: opts.client ?? clientId },
		fields
	});
	return clientPageActions.saveBilling(event as never);
}

function asClient(fields: Record<string, string>, ownClientId: string | null = clientId) {
	const event = mkEvent({ locals: { clientId: ownClientId }, fields });
	return portalDetailsActions.saveBilling(event as never);
}

async function billingRow(id: string = clientId) {
	const [row] = await db.select().from(clientBilling).where(eq(clientBilling.clientId, id));
	return row;
}

describe('therapist saveBilling', () => {
	it('saves details and tax settings', async () => {
		await asTherapist({
			companyName: 'Acme Pvt Ltd',
			stateCode: '27',
			gstin: '27aapfu0939f1zv',
			taxType: 'cgst_sgst',
			gstRate: '5',
			extraFieldLabel: 'PO',
			extraFieldValue: '991'
		});
		const row = await billingRow();
		expect(row.companyName).toBe('Acme Pvt Ltd');
		expect(row.gstin).toBe('27AAPFU0939F1ZV');
		expect(row.taxType).toBe('cgst_sgst');
		expect(row.gstRate).toBe(5);
		expect(row.extraFields).toEqual([{ label: 'PO', value: '991' }]);
		expect(row.autoSend).toBe(false);
		expect(row.autoInvoice).toBe(false);
	});

	it('turns auto_invoice on and off', async () => {
		await asTherapist({ taxType: 'auto', autoInvoice: 'on' });
		expect((await billingRow()).autoInvoice).toBe(true);
		await asTherapist({ taxType: 'auto' });
		expect((await billingRow()).autoInvoice).toBe(false);
	});

	it("refuses another therapist's client", async () => {
		const otherTherapist = (await mkTherapist({ currency: 'INR' })).id;
		const result = await asTherapist(
			{ companyName: 'Hijack', taxType: 'auto' },
			{ therapist: otherTherapist }
		);
		expect(isActionFailure(result)).toBe(true);
		expect(await billingRow()).toBeUndefined();
	});

	it('refuses a non-INR practice', async () => {
		const usd = (await mkTherapist({ currency: 'USD' })).id;
		const usdClient = (await mkClient(usd)).id;
		const result = await asTherapist({ taxType: 'auto' }, { therapist: usd, client: usdClient });
		expect(isActionFailure(result)).toBe(true);
		expect(await billingRow(usdClient)).toBeUndefined();
	});
});

describe('portal saveBilling', () => {
	it("edits the client's own details", async () => {
		await asClient({ companyName: 'My Co', billingEmail: 'billing@myco.in' });
		const row = await billingRow();
		expect(row.companyName).toBe('My Co');
		expect(row.billingEmail).toBe('billing@myco.in');
	});

	it("can't change tax type, GST rate, auto_send or auto_invoice", async () => {
		await asTherapist({ taxType: 'igst', gstRate: '18' });
		await db.update(clientBilling).set({ autoSend: true }).where(eq(clientBilling.clientId, clientId));

		await asClient({
			companyName: 'My Co',
			taxType: 'none',
			gstRate: '0',
			autoSend: 'on',
			autoInvoice: 'on'
		});

		const row = await billingRow();
		expect(row.companyName).toBe('My Co');
		expect(row.taxType).toBe('igst');
		expect(row.gstRate).toBe(18);
		expect(row.autoSend).toBe(true);
		expect(row.autoInvoice).toBe(false);
	});

	it('refuses without a client session', async () => {
		const result = await asClient({ companyName: 'Anon' }, null);
		expect(isActionFailure(result)).toBe(true);
		expect(await billingRow()).toBeUndefined();
	});
});
