import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoice, invoiceSettings } from '$lib/server/db/schema';
import { issueInvoice } from '$lib/server/invoices';
import { deleteObject } from '$lib/server/storage';
import type { InvoiceIssueEdits } from '$lib/invoiceValidation';
import { actions as settingsActions } from '../../src/routes/(app)/settings/invoices/+page.server';
import { load as portalListLoad } from '../../src/routes/(portal)/portal/invoices/+page.server';
import { load as portalViewLoad } from '../../src/routes/(portal)/portal/invoices/[id]/+page.server';
import { resetDb, mkTherapist, mkClient, mkPayment, mkEvent } from './helpers';

// Step 5: invoices keep the logo/signature they were issued with, and a client
// sees only their own invoices in the portal. See docs/invoice.md.

vi.mock('$lib/server/storage', () => ({
	putObject: vi.fn(async () => {}),
	deleteObject: vi.fn(async () => {}),
	signedUrl: vi.fn(async (key: string) => `https://signed.test/${key}`)
}));

let therapistId: string;
let clientId: string;

beforeEach(async () => {
	await resetDb();
	vi.mocked(deleteObject).mockClear();
	therapistId = (await mkTherapist({ currency: 'INR' })).id;
	clientId = (await mkClient(therapistId, { name: 'Sam Client' })).id;
	await db.insert(invoiceSettings).values({
		therapistId,
		address: '12 MG Road, Pune',
		stateCode: '27',
		numberPrefix: 'ANV',
		logoKey: 'invoice/t/logo/old',
		signatureKey: 'invoice/t/signature/old'
	});
});

function edits(amount: string): InvoiceIssueEdits {
	return {
		date: '2026-11-03',
		taxType: 'auto',
		buyer: { name: 'Sam Client', address: '', gstin: '', stateCode: '27' },
		lines: [{ id: 'a', description: 'Therapy session', sacCode: '9993', amount, gstRate: '18' }]
	};
}

async function issueFor(ownerClientId: string | null, customName: string | null = null) {
	const paymentRow = await mkPayment(therapistId, ownerClientId as string, {
		amount: 1180,
		clientId: ownerClientId,
		customName
	});
	const result = await issueInvoice(therapistId, paymentRow.id, edits('1180'));
	if (!result.ok) {
		throw new Error(`issue failed: ${result.reason}`);
	}
	return result.invoiceId;
}

function removeLogo() {
	const event = mkEvent({
		locals: { therapistId },
		fields: {
			address: '12 MG Road, Pune',
			stateCode: '27',
			sacCode: '9993',
			defaultGstRate: '18',
			numberPrefix: 'ANV',
			nextNumber: '1',
			removeLogo: 'on'
		}
	});
	return settingsActions.save(event as never);
}

function portalEvent(ownClientId: string, params: Record<string, string> = {}) {
	return mkEvent({
		params,
		parent: async () => ({ client: { id: ownClientId, therapistId }, currency: 'INR' })
	});
}

describe('invoice images', () => {
	it('an issued invoice keeps the settings logo and signature keys', async () => {
		const invoiceId = await issueFor(clientId);
		const [row] = await db.select().from(invoice).where(eq(invoice.id, invoiceId));
		expect(row.logoKey).toBe('invoice/t/logo/old');
		expect(row.signatureKey).toBe('invoice/t/signature/old');
	});

	it('removing a logo an invoice uses keeps the file', async () => {
		await issueFor(clientId);
		const result = await removeLogo();
		expect(result).toEqual({ saved: true });
		expect(deleteObject).not.toHaveBeenCalled();
	});

	it('removing a logo no invoice uses deletes the file', async () => {
		const result = await removeLogo();
		expect(result).toEqual({ saved: true });
		expect(deleteObject).toHaveBeenCalledWith('invoice/t/logo/old');
	});
});

describe('portal invoices', () => {
	it("lists only the client's own invoices", async () => {
		const otherClientId = (await mkClient(therapistId, { name: 'Other' })).id;
		const mine = await issueFor(clientId);
		await issueFor(otherClientId);
		await issueFor(null, 'Walk-in');

		const data = await portalListLoad(portalEvent(clientId) as never);
		if (!data) {
			throw new Error('no data');
		}
		const ids: string[] = [];
		for (const row of data.invoices) {
			ids.push(row.id);
		}
		expect(ids).toEqual([mine]);
	});

	it("another client's invoice is not found", async () => {
		const otherClientId = (await mkClient(therapistId, { name: 'Other' })).id;
		const theirs = await issueFor(otherClientId);
		await expect(
			portalViewLoad(portalEvent(clientId, { id: theirs }) as never)
		).rejects.toMatchObject({ status: 404 });
	});

	it('shows the own invoice with its images', async () => {
		const mine = await issueFor(clientId);
		const data = await portalViewLoad(portalEvent(clientId, { id: mine }) as never);
		if (!data) {
			throw new Error('no data');
		}
		expect(data.invoice.id).toBe(mine);
		expect(data.images.logoUrl).toBe('https://signed.test/invoice/t/logo/old');
	});
});
