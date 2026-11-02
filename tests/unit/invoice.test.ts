import { describe, it, expect } from 'vitest';
import {
	computeInvoice,
	emptyInvoice,
	formatInvoiceDate,
	parseAmountToPaise,
	resolveTaxType,
	type InvoiceDraft
} from '../../src/lib/invoice';

function draft(overrides: {
	sellerGstin?: string;
	sellerState?: string;
	buyerState?: string;
	taxType?: InvoiceDraft['taxType'];
	amounts?: string[];
	rate?: string;
}): InvoiceDraft {
	const invoice = emptyInvoice('2026-11-02');
	invoice.seller.gstin = overrides.sellerGstin ?? '27ABCDE1234F1Z5';
	invoice.seller.stateCode = overrides.sellerState ?? '27';
	invoice.buyer.stateCode = overrides.buyerState ?? '27';
	invoice.taxType = overrides.taxType ?? 'auto';
	const amounts = overrides.amounts ?? ['1180'];
	const template = invoice.lines[0];
	invoice.lines = [];
	for (const amount of amounts) {
		invoice.lines.push({ ...template, id: crypto.randomUUID(), amount, gstRate: overrides.rate ?? '18' });
	}
	return invoice;
}

describe('resolveTaxType', () => {
	it('splits CGST/SGST when buyer is in the same state', () => {
		expect(resolveTaxType(draft({}))).toBe('cgst_sgst');
	});

	it('uses IGST for another state or outside India', () => {
		expect(resolveTaxType(draft({ buyerState: '29' }))).toBe('igst');
		expect(resolveTaxType(draft({ buyerState: '96' }))).toBe('igst');
	});

	it('is none when the seller has no GSTIN', () => {
		expect(resolveTaxType(draft({ sellerGstin: '  ' }))).toBe('none');
	});

	it('an explicit choice beats every rule', () => {
		expect(resolveTaxType(draft({ sellerGstin: '', taxType: 'igst' }))).toBe('igst');
		expect(resolveTaxType(draft({ buyerState: '29', taxType: 'cgst_sgst' }))).toBe('cgst_sgst');
		expect(resolveTaxType(draft({ taxType: 'none' }))).toBe('none');
	});
});

describe('computeInvoice', () => {
	it('back-calculates taxable value from a GST-inclusive amount', () => {
		const result = computeInvoice(draft({ amounts: ['1180'] }));
		expect(result.title).toBe('Tax Invoice');
		expect(result.taxablePaise).toBe(100000);
		expect(result.cgstPaise).toBe(9000);
		expect(result.sgstPaise).toBe(9000);
		expect(result.igstPaise).toBe(0);
		expect(result.totalPaise).toBe(118000);
	});

	it('puts all tax in IGST across states', () => {
		const result = computeInvoice(draft({ buyerState: '29', amounts: ['1180'] }));
		expect(result.igstPaise).toBe(18000);
		expect(result.cgstPaise + result.sgstPaise).toBe(0);
	});

	it('always sums back exactly and gives the odd paisa to SGST', () => {
		const result = computeInvoice(draft({ amounts: ['999', '1', '1500.55'] }));
		for (const line of result.lines) {
			expect(line.taxablePaise + line.cgstPaise + line.sgstPaise).toBe(line.totalPaise);
			expect(line.sgstPaise - line.cgstPaise).toBeGreaterThanOrEqual(0);
			expect(line.sgstPaise - line.cgstPaise).toBeLessThanOrEqual(1);
		}
		expect(result.taxablePaise + result.cgstPaise + result.sgstPaise).toBe(result.totalPaise);
		expect(result.totalPaise).toBe(250055);
	});

	it('is a Bill of Supply with no tax when type resolves to none', () => {
		const result = computeInvoice(draft({ sellerGstin: '', amounts: ['1000'] }));
		expect(result.title).toBe('Bill of Supply');
		expect(result.taxablePaise).toBe(100000);
		expect(result.lines[0].gstRate).toBe(0);
		expect(result.cgstPaise + result.sgstPaise + result.igstPaise).toBe(0);
	});

	it('treats half-typed or junk input as zero instead of NaN', () => {
		const result = computeInvoice(draft({ amounts: ['', 'abc', '12.'], rate: 'x' }));
		expect(result.totalPaise).toBe(1200);
		expect(result.taxablePaise).toBe(1200);
	});
});

describe('parseAmountToPaise', () => {
	it('accepts commas and decimals', () => {
		expect(parseAmountToPaise('1,200.50')).toBe(120050);
	});
});

describe('formatInvoiceDate', () => {
	it('formats YYYY-MM-DD and rejects anything else', () => {
		expect(formatInvoiceDate('2026-11-02')).toBe('02 Nov 2026');
		expect(formatInvoiceDate('')).toBe('');
	});
});
