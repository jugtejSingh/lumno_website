import { describe, it, expect } from 'vitest';
import {
	isValidGstin,
	isValidInvoicePrefix,
	parseGstRate,
	parseExtraFields,
	parseInvoiceSettingsForm,
	parseClientBillingDetailsForm,
	parseClientBillingTaxForm,
	MAX_EXTRA_FIELDS,
	parseInvoiceIssueEdits
} from '../../src/lib/invoiceValidation';

function validForm(overrides: Record<string, string> = {}): FormData {
	const form = new FormData();
	const base: Record<string, string> = {
		address: '12 MG Road, Pune',
		stateCode: '27',
		gstin: '27aapfu0939f1zv',
		sacCode: '9993',
		defaultGstRate: '18',
		numberPrefix: 'ANV',
		nextNumber: '13',
		legalName: '',
		footer: ''
	};
	for (const key of Object.keys(overrides)) {
		base[key] = overrides[key];
	}
	for (const key of Object.keys(base)) {
		form.set(key, base[key]);
	}
	return form;
}

describe('isValidGstin', () => {
	it('accepts a 15-character GSTIN with a known state code', () => {
		expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
	});

	it('rejects 14 and 16 characters', () => {
		expect(isValidGstin('27AAPFU0939F1Z')).toBe(false);
		expect(isValidGstin('27AAPFU0939F1ZVX')).toBe(false);
	});

	it('rejects an unknown state code', () => {
		expect(isValidGstin('99AAPFU0939F1ZV')).toBe(false);
	});

	it('rejects lowercase (the form uppercases first)', () => {
		expect(isValidGstin('27aapfu0939f1zv')).toBe(false);
	});
});

describe('isValidInvoicePrefix', () => {
	it('allows up to 3 characters so the number fits in 16', () => {
		expect(isValidInvoicePrefix('ANV')).toBe(true);
		expect(isValidInvoicePrefix('ANVX')).toBe(false);
		expect('ANV/2026-27/0013'.length).toBe(16);
	});

	it('rejects spaces and symbols', () => {
		expect(isValidInvoicePrefix('A V')).toBe(false);
		expect(isValidInvoicePrefix('A#')).toBe(false);
	});
});

describe('parseGstRate', () => {
	it('takes whole numbers 0–100', () => {
		expect(parseGstRate('0')).toBe(0);
		expect(parseGstRate(' 18 ')).toBe(18);
		expect(parseGstRate('100')).toBe(100);
	});

	it('rejects decimals, negatives, over 100 and blank', () => {
		expect(parseGstRate('18.5')).toBeNull();
		expect(parseGstRate('-5')).toBeNull();
		expect(parseGstRate('101')).toBeNull();
		expect(parseGstRate('')).toBeNull();
	});
});

describe('parseExtraFields', () => {
	it('drops fully blank rows and trims', () => {
		expect(parseExtraFields([' PAN ', ''], [' ABCDE1234F ', ''])).toEqual({
			fields: [{ label: 'PAN', value: 'ABCDE1234F' }]
		});
	});

	it('needs a label when there is a value', () => {
		expect(parseExtraFields([''], ['x'])).toEqual({ error: 'Every extra field needs a label' });
	});

	it('caps the count', () => {
		const labels: string[] = [];
		const values: string[] = [];
		for (let index = 0; index <= MAX_EXTRA_FIELDS; index++) {
			labels.push(`L${index}`);
			values.push('v');
		}
		expect('error' in parseExtraFields(labels, values)).toBe(true);
	});
});

function formOf(fields: Record<string, string>): FormData {
	const form = new FormData();
	for (const key of Object.keys(fields)) {
		form.set(key, fields[key]);
	}
	return form;
}

describe('parseClientBillingDetailsForm', () => {
	it('allows everything blank', () => {
		expect(parseClientBillingDetailsForm(formOf({}))).toEqual({
			details: {
				companyName: null,
				billingEmail: null,
				address: null,
				gstin: null,
				stateCode: null,
				extraFields: []
			}
		});
	});

	it('allows 96 for a buyer outside India', () => {
		const result = parseClientBillingDetailsForm(formOf({ stateCode: '96' }));
		expect('details' in result && result.details.stateCode).toBe('96');
	});

	it('uppercases the GSTIN and checks it against the state when both are set', () => {
		const ok = parseClientBillingDetailsForm(formOf({ gstin: '27aapfu0939f1zv' }));
		expect('details' in ok && ok.details.gstin).toBe('27AAPFU0939F1ZV');
		expect(
			parseClientBillingDetailsForm(formOf({ gstin: '27AAPFU0939F1ZV', stateCode: '29' }))
		).toMatchObject({ field: 'gstin' });
	});

	it('rejects a bad email and an unknown state', () => {
		expect(parseClientBillingDetailsForm(formOf({ billingEmail: 'nope' }))).toMatchObject({
			field: 'billingEmail'
		});
		expect(parseClientBillingDetailsForm(formOf({ stateCode: '99' }))).toMatchObject({
			field: 'stateCode'
		});
	});
});

describe('parseClientBillingTaxForm', () => {
	it('blank GST rate means the default (null)', () => {
		expect(parseClientBillingTaxForm(formOf({ taxType: 'auto', gstRate: '' }))).toEqual({
			tax: { taxType: 'auto', gstRate: null, autoInvoice: false }
		});
	});

	it('takes a typed rate and the auto-invoice switch', () => {
		expect(
			parseClientBillingTaxForm(formOf({ taxType: 'none', gstRate: '5', autoInvoice: 'on' }))
		).toEqual({
			tax: { taxType: 'none', gstRate: 5, autoInvoice: true }
		});
	});

	it('rejects an unknown tax type and a bad rate', () => {
		expect(parseClientBillingTaxForm(formOf({ taxType: 'vat' }))).toMatchObject({
			field: 'taxType'
		});
		expect(parseClientBillingTaxForm(formOf({ taxType: 'igst', gstRate: '12.5' }))).toMatchObject(
			{ field: 'gstRate' }
		);
	});
});

describe('parseInvoiceSettingsForm', () => {
	it('parses a valid form, uppercasing the GSTIN and nulling blanks', () => {
		const result = parseInvoiceSettingsForm(validForm());
		expect(result).toEqual({
			settings: {
				legalName: null,
				address: '12 MG Road, Pune',
				stateCode: '27',
				gstin: '27AAPFU0939F1ZV',
				sacCode: '9993',
				defaultGstRate: 18,
				numberPrefix: 'ANV',
				nextNumber: 13,
				footer: null,
				extraFields: []
			}
		});
	});

	it('allows no GSTIN (Bill of Supply)', () => {
		const result = parseInvoiceSettingsForm(validForm({ gstin: '' }));
		expect('settings' in result && result.settings.gstin).toBeNull();
	});

	it('requires the GSTIN to match the state', () => {
		const result = parseInvoiceSettingsForm(validForm({ stateCode: '29' }));
		expect(result).toMatchObject({ field: 'gstin' });
	});

	it('rejects state 96 for the seller', () => {
		const result = parseInvoiceSettingsForm(validForm({ stateCode: '96', gstin: '' }));
		expect(result).toMatchObject({ field: 'stateCode' });
	});

	it('flags each bad field by name', () => {
		expect(parseInvoiceSettingsForm(validForm({ address: ' ' }))).toMatchObject({
			field: 'address'
		});
		expect(parseInvoiceSettingsForm(validForm({ sacCode: '99' }))).toMatchObject({
			field: 'sacCode'
		});
		expect(parseInvoiceSettingsForm(validForm({ defaultGstRate: '18%' }))).toMatchObject({
			field: 'defaultGstRate'
		});
		expect(parseInvoiceSettingsForm(validForm({ numberPrefix: 'ANVX' }))).toMatchObject({
			field: 'numberPrefix'
		});
		expect(parseInvoiceSettingsForm(validForm({ nextNumber: '0' }))).toMatchObject({
			field: 'nextNumber'
		});
		expect(parseInvoiceSettingsForm(validForm({ nextNumber: '10000' }))).toMatchObject({
			field: 'nextNumber'
		});
	});
});

describe('parseInvoiceIssueEdits', () => {
	const TODAY = '2026-11-03';

	function posted(overrides: Record<string, unknown> = {}): string {
		const base: Record<string, unknown> = {
			date: '2026-11-03',
			taxType: 'auto',
			buyer: { name: ' Sam ', address: '', gstin: '', stateCode: '27' },
			lines: [{ id: 'a', description: 'Therapy session', sacCode: '9993', amount: '1,500', gstRate: '18' }]
		};
		for (const key of Object.keys(overrides)) {
			base[key] = overrides[key];
		}
		return JSON.stringify(base);
	}

	it('returns cleaned edits', () => {
		const result = parseInvoiceIssueEdits(posted(), TODAY);
		expect(result).toEqual({
			edits: {
				date: '2026-11-03',
				taxType: 'auto',
				buyer: { name: 'Sam', address: '', gstin: '', stateCode: '27' },
				lines: [{ id: 'a', description: 'Therapy session', sacCode: '9993', amount: '1500', gstRate: '18' }]
			}
		});
	});

	it('refuses a future or invalid date', () => {
		expect(parseInvoiceIssueEdits(posted({ date: '2026-11-04' }), TODAY)).toMatchObject({ field: 'date' });
		expect(parseInvoiceIssueEdits(posted({ date: '2026-02-30' }), TODAY)).toMatchObject({ field: 'date' });
	});

	it('refuses a GSTIN that does not match the state', () => {
		const buyer = { name: 'Acme', address: '', gstin: '29AAPFU0939F1ZV', stateCode: '27' };
		expect(parseInvoiceIssueEdits(posted({ buyer }), TODAY)).toMatchObject({ field: 'buyer' });
	});

	it('refuses bad lines', () => {
		expect(parseInvoiceIssueEdits(posted({ lines: [] }), TODAY)).toMatchObject({ field: 'lines' });
		const zero = [{ description: 'x', sacCode: '9993', amount: '0', gstRate: '18' }];
		expect(parseInvoiceIssueEdits(posted({ lines: zero }), TODAY)).toMatchObject({ field: 'lines' });
		const badSac = [{ description: 'x', sacCode: '99', amount: '10', gstRate: '18' }];
		expect(parseInvoiceIssueEdits(posted({ lines: badSac }), TODAY)).toMatchObject({ field: 'lines' });
	});

	it('refuses unreadable JSON and unknown tax types', () => {
		expect(parseInvoiceIssueEdits('{', TODAY)).toMatchObject({ field: '' });
		expect(parseInvoiceIssueEdits(posted({ taxType: 'vat' }), TODAY)).toMatchObject({ field: 'taxType' });
	});
});
