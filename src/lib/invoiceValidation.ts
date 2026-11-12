// Validation shared by the invoice settings and client billing forms, browser
// and server. Pure — no DB. See docs/invoice.md.
import { GST_STATES, type TaxTypeChoice } from './invoice';

export type InvoiceExtraField = { label: string; value: string };

export const MAX_EXTRA_FIELDS = 10;
// GST caps an invoice number at 16 characters. "/2026-27/0001" is 13, so the
// prefix gets the remaining 3.
export const MAX_PREFIX_LENGTH = 3;

// 2-digit state + 10-char PAN (5 letters, 4 digits, 1 letter) + entity number
// + 'Z' + check character = 15.
// ponytail: format only, the check character isn't verified; add the mod-36
// checksum if typos slip through.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PREFIX_PATTERN = /^[A-Za-z0-9/-]+$/;
const SAC_PATTERN = /^[0-9]{4,8}$/;

export function isKnownStateCode(code: string): boolean {
	for (const state of GST_STATES) {
		if (state.code === code) {
			return true;
		}
	}
	return false;
}

export function isValidGstin(gstin: string): boolean {
	if (!GSTIN_PATTERN.test(gstin)) {
		return false;
	}
	return isKnownStateCode(gstin.slice(0, 2));
}

export function isValidInvoicePrefix(prefix: string): boolean {
	if (prefix.length > MAX_PREFIX_LENGTH) {
		return false;
	}
	return PREFIX_PATTERN.test(prefix);
}

export function isValidSacCode(sac: string): boolean {
	return SAC_PATTERN.test(sac);
}

// Whole percent, 0–100. Typed in by the therapist; no fixed slab list, since
// GST rates change.
export function parseGstRate(text: string): number | null {
	const trimmed = text.trim();
	if (!/^[0-9]{1,3}$/.test(trimmed)) {
		return null;
	}
	const rate = Number(trimmed);
	if (rate > 100) {
		return null;
	}
	return rate;
}

// Parallel label/value lists from the form. Rows with both blank are dropped.
export function parseExtraFields(
	labels: string[],
	values: string[]
): { fields: InvoiceExtraField[] } | { error: string } {
	const fields: InvoiceExtraField[] = [];
	for (let index = 0; index < labels.length; index++) {
		const label = labels[index].trim();
		let value = '';
		if (index < values.length) {
			value = values[index].trim();
		}
		if (label === '' && value === '') {
			continue;
		}
		if (label === '') {
			return { error: 'Every extra field needs a label' };
		}
		fields.push({ label, value });
	}
	if (fields.length > MAX_EXTRA_FIELDS) {
		return { error: `At most ${MAX_EXTRA_FIELDS} extra fields` };
	}
	return { fields };
}

export type InvoiceSettingsInput = {
	legalName: string | null;
	address: string;
	stateCode: string;
	gstin: string | null;
	sacCode: string;
	defaultGstRate: number;
	numberPrefix: string | null;
	nextNumber: number;
	footer: string | null;
	extraFields: InvoiceExtraField[];
};

export type FieldError = { field: string; message: string };

function text(form: FormData, name: string): string {
	const value = form.get(name);
	if (typeof value === 'string') {
		return value.trim();
	}
	return '';
}

function orNull(value: string): string | null {
	if (value === '') {
		return null;
	}
	return value;
}

function parseExtraFieldsFrom(form: FormData) {
	const labels: string[] = [];
	for (const value of form.getAll('extraFieldLabel')) {
		labels.push(value.toString());
	}
	const values: string[] = [];
	for (const value of form.getAll('extraFieldValue')) {
		values.push(value.toString());
	}
	return parseExtraFields(labels, values);
}

// What the client or the therapist can edit on a client's billing details.
export type ClientBillingDetailsInput = {
	companyName: string | null;
	billingEmail: string | null;
	address: string | null;
	gstin: string | null;
	stateCode: string | null;
	extraFields: InvoiceExtraField[];
};

// Therapist only: tax decisions (a client could otherwise set themselves to 0%).
export type ClientBillingTaxInput = {
	taxType: TaxTypeChoice;
	gstRate: number | null;
	autoInvoice: boolean;
};

const TAX_TYPE_CHOICES: TaxTypeChoice[] = ['auto', 'cgst_sgst', 'igst', 'none'];
// ponytail: shape check only; the mail provider bounces the rest
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every field optional. 96 (outside India) is allowed for a buyer.
export function parseClientBillingDetailsForm(
	form: FormData
): { details: ClientBillingDetailsInput } | FieldError {
	const billingEmail = text(form, 'billingEmail');
	if (billingEmail !== '' && !EMAIL_PATTERN.test(billingEmail)) {
		return { field: 'billingEmail', message: 'Enter a valid email address' };
	}

	const stateCode = text(form, 'stateCode');
	if (stateCode !== '' && !isKnownStateCode(stateCode)) {
		return { field: 'stateCode', message: 'Pick a state' };
	}

	const gstin = text(form, 'gstin').toUpperCase();
	if (gstin !== '') {
		if (!isValidGstin(gstin)) {
			return { field: 'gstin', message: 'A GSTIN is 15 characters, e.g. 27AAPFU0939F1ZV' };
		}
		if (stateCode !== '' && gstin.slice(0, 2) !== stateCode) {
			return { field: 'gstin', message: "The GSTIN's first 2 digits must match the state" };
		}
	}

	const extra = parseExtraFieldsFrom(form);
	if ('error' in extra) {
		return { field: 'extraFields', message: extra.error };
	}

	return {
		details: {
			companyName: orNull(text(form, 'companyName')),
			billingEmail: orNull(billingEmail),
			address: orNull(text(form, 'address')),
			gstin: orNull(gstin),
			stateCode: orNull(stateCode),
			extraFields: extra.fields
		}
	};
}

export function parseClientBillingTaxForm(form: FormData): { tax: ClientBillingTaxInput } | FieldError {
	const taxTypeText = text(form, 'taxType');
	let taxType: TaxTypeChoice | null = null;
	for (const choice of TAX_TYPE_CHOICES) {
		if (choice === taxTypeText) {
			taxType = choice;
		}
	}
	if (taxType === null) {
		return { field: 'taxType', message: 'Pick a tax type' };
	}

	// blank = use the default rate from invoice settings
	const gstRateText = text(form, 'gstRate');
	let gstRate: number | null = null;
	if (gstRateText !== '') {
		gstRate = parseGstRate(gstRateText);
		if (gstRate === null) {
			return { field: 'gstRate', message: 'GST rate is a whole number from 0 to 100' };
		}
	}

	// a checkbox: absent (unticked) = off
	const autoInvoice = form.get('autoInvoice') === 'on';

	return { tax: { taxType, gstRate, autoInvoice } };
}

// What the therapist may change on /invoice before issuing. Seller, footer and
// number come from invoice settings on the server, never from the browser.
export type InvoiceIssueEdits = {
	date: string;
	taxType: TaxTypeChoice;
	buyer: { name: string; address: string; gstin: string; stateCode: string };
	lines: { id: string; description: string; sacCode: string; amount: string; gstRate: string }[];
};

export const MAX_INVOICE_LINES = 20;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const AMOUNT_PATTERN = /^[0-9]+(\.[0-9]{1,2})?$/;

function stringOf(value: unknown): string {
	if (typeof value === 'string') {
		return value.trim();
	}
	return '';
}

function isRealDate(date: string): boolean {
	if (!DATE_PATTERN.test(date)) {
		return false;
	}
	const parsed = new Date(`${date}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) {
		return false;
	}
	return parsed.toISOString().slice(0, 10) === date;
}

// `posted` is the JSON the /invoice form sends; `today` is YYYY-MM-DD in the
// therapist's timezone (an invoice can be back-dated, not future-dated).
export function parseInvoiceIssueEdits(
	posted: string,
	today: string
): { edits: InvoiceIssueEdits } | FieldError {
	let raw: unknown;
	try {
		raw = JSON.parse(posted);
	} catch {
		return { field: '', message: 'Invoice data was unreadable — reload and try again' };
	}
	if (typeof raw !== 'object' || raw === null) {
		return { field: '', message: 'Invoice data was unreadable — reload and try again' };
	}
	const input = raw as Record<string, unknown>;

	const date = stringOf(input.date);
	if (!isRealDate(date)) {
		return { field: 'date', message: 'Pick an invoice date' };
	}
	if (date > today) {
		return { field: 'date', message: "An invoice can't be dated in the future" };
	}

	const taxTypeText = stringOf(input.taxType);
	let taxType: TaxTypeChoice | null = null;
	for (const choice of TAX_TYPE_CHOICES) {
		if (choice === taxTypeText) {
			taxType = choice;
		}
	}
	if (taxType === null) {
		return { field: 'taxType', message: 'Pick a tax type' };
	}

	let buyerInput: Record<string, unknown> = {};
	if (typeof input.buyer === 'object' && input.buyer !== null) {
		buyerInput = input.buyer as Record<string, unknown>;
	}
	const buyerName = stringOf(buyerInput.name);
	if (buyerName === '') {
		return { field: 'buyer', message: 'Add who this invoice is for' };
	}
	const buyerState = stringOf(buyerInput.stateCode);
	if (buyerState !== '' && !isKnownStateCode(buyerState)) {
		return { field: 'buyer', message: "Pick the buyer's state" };
	}
	const buyerGstin = stringOf(buyerInput.gstin).toUpperCase();
	if (buyerGstin !== '') {
		if (!isValidGstin(buyerGstin)) {
			return { field: 'buyer', message: "The buyer's GSTIN is 15 characters, e.g. 27AAPFU0939F1ZV" };
		}
		if (buyerState !== '' && buyerGstin.slice(0, 2) !== buyerState) {
			return { field: 'buyer', message: "The buyer's GSTIN must match their state" };
		}
	}

	if (!Array.isArray(input.lines) || input.lines.length === 0) {
		return { field: 'lines', message: 'Add at least one line' };
	}
	if (input.lines.length > MAX_INVOICE_LINES) {
		return { field: 'lines', message: `At most ${MAX_INVOICE_LINES} lines` };
	}
	const lines: InvoiceIssueEdits['lines'] = [];
	for (let index = 0; index < input.lines.length; index++) {
		const lineNumber = index + 1;
		let lineInput: Record<string, unknown> = {};
		if (typeof input.lines[index] === 'object' && input.lines[index] !== null) {
			lineInput = input.lines[index] as Record<string, unknown>;
		}
		const description = stringOf(lineInput.description);
		if (description === '') {
			return { field: 'lines', message: `Item ${lineNumber} needs a description` };
		}
		const sacCode = stringOf(lineInput.sacCode);
		if (!isValidSacCode(sacCode)) {
			return { field: 'lines', message: `Item ${lineNumber}: SAC code is 4 to 8 digits` };
		}
		const amount = stringOf(lineInput.amount).replaceAll(',', '');
		if (!AMOUNT_PATTERN.test(amount) || Number(amount) <= 0) {
			return { field: 'lines', message: `Item ${lineNumber}: enter an amount, e.g. 1500 or 1500.50` };
		}
		const gstRate = parseGstRate(stringOf(lineInput.gstRate));
		if (gstRate === null) {
			return { field: 'lines', message: `Item ${lineNumber}: GST rate is a whole number from 0 to 100` };
		}
		let id = stringOf(lineInput.id);
		if (id === '') {
			id = String(lineNumber);
		}
		lines.push({ id, description, sacCode, amount, gstRate: String(gstRate) });
	}

	return {
		edits: {
			date,
			taxType,
			buyer: {
				name: buyerName,
				address: stringOf(buyerInput.address),
				gstin: buyerGstin,
				stateCode: buyerState
			},
			lines
		}
	};
}

// Logo/signature files are handled by the action, not here.
export function parseInvoiceSettingsForm(
	form: FormData
): { settings: InvoiceSettingsInput } | FieldError {
	const address = text(form, 'address');
	if (address === '') {
		return { field: 'address', message: 'Address is required' };
	}

	const stateCode = text(form, 'stateCode');
	// 96 is a buyer outside India; a seller registered here can't be
	if (!isKnownStateCode(stateCode) || stateCode === '96') {
		return { field: 'stateCode', message: 'Pick your state' };
	}

	const gstin = text(form, 'gstin').toUpperCase();
	if (gstin !== '') {
		if (!isValidGstin(gstin)) {
			return { field: 'gstin', message: 'A GSTIN is 15 characters, e.g. 27AAPFU0939F1ZV' };
		}
		if (gstin.slice(0, 2) !== stateCode) {
			return { field: 'gstin', message: "The GSTIN's first 2 digits must match your state" };
		}
	}

	const sacCode = text(form, 'sacCode');
	if (!isValidSacCode(sacCode)) {
		return { field: 'sacCode', message: 'SAC code is 4 to 8 digits' };
	}

	const defaultGstRate = parseGstRate(text(form, 'defaultGstRate'));
	if (defaultGstRate === null) {
		return { field: 'defaultGstRate', message: 'GST rate is a whole number from 0 to 100' };
	}

	const numberPrefix = text(form, 'numberPrefix');
	if (numberPrefix !== '' && !isValidInvoicePrefix(numberPrefix)) {
		return {
			field: 'numberPrefix',
			message: `Up to ${MAX_PREFIX_LENGTH} letters, digits, - or /`
		};
	}

	const nextNumberText = text(form, 'nextNumber');
	if (!/^[0-9]{1,4}$/.test(nextNumberText) || Number(nextNumberText) < 1) {
		return { field: 'nextNumber', message: 'Next invoice number is from 1 to 9999' };
	}

	const extra = parseExtraFieldsFrom(form);
	if ('error' in extra) {
		return { field: 'extraFields', message: extra.error };
	}

	return {
		settings: {
			legalName: orNull(text(form, 'legalName')),
			address,
			stateCode,
			gstin: orNull(gstin),
			sacCode,
			defaultGstRate,
			numberPrefix: orNull(numberPrefix),
			nextNumber: Number(nextNumberText),
			footer: orNull(text(form, 'footer')),
			extraFields: extra.fields
		}
	};
}
