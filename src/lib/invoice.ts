// Invoice data + GST maths. Lives in $lib (not $lib/server) so the /invoice
// editor can preview live in the browser and the server can reuse the same
// maths when it renders the PDF later. See docs/invoice.md.

export type TaxTypeChoice = 'auto' | 'cgst_sgst' | 'igst' | 'none';
export type TaxType = 'cgst_sgst' | 'igst' | 'none';

export type InvoiceParty = {
	name: string;
	address: string;
	gstin: string;
	stateCode: string;
	// printed under the party (PAN, PO number…); copied from settings / client billing
	extraFields: { label: string; value: string }[];
};

// amount and gstRate stay as typed text so a half-typed "12." isn't rewritten
// under the cursor; computeInvoice parses them.
export type InvoiceLine = {
	id: string;
	description: string;
	sacCode: string;
	amount: string;
	gstRate: string;
};

export type InvoiceDraft = {
	number: string;
	date: string; // YYYY-MM-DD
	taxType: TaxTypeChoice;
	seller: InvoiceParty;
	buyer: InvoiceParty;
	lines: InvoiceLine[];
	footer: string;
};

// All money below is in paise so the tax split sums back exactly.
export type ComputedLine = {
	id: string;
	description: string;
	sacCode: string;
	gstRate: number;
	taxablePaise: number;
	cgstPaise: number;
	sgstPaise: number;
	igstPaise: number;
	totalPaise: number;
};

export type ComputedInvoice = {
	title: string;
	taxType: TaxType;
	lines: ComputedLine[];
	taxablePaise: number;
	cgstPaise: number;
	sgstPaise: number;
	igstPaise: number;
	totalPaise: number;
};

export const DEFAULT_SAC_CODE = '9993';
export const DEFAULT_GST_RATE = '18';

// GST state codes. 25 was merged into 26 and 28 is pre-split Andhra Pradesh,
// so neither is listed. 96 is the code GST uses for a buyer outside India.
export const GST_STATES: { code: string; name: string }[] = [
	{ code: '01', name: 'Jammu and Kashmir' },
	{ code: '02', name: 'Himachal Pradesh' },
	{ code: '03', name: 'Punjab' },
	{ code: '04', name: 'Chandigarh' },
	{ code: '05', name: 'Uttarakhand' },
	{ code: '06', name: 'Haryana' },
	{ code: '07', name: 'Delhi' },
	{ code: '08', name: 'Rajasthan' },
	{ code: '09', name: 'Uttar Pradesh' },
	{ code: '10', name: 'Bihar' },
	{ code: '11', name: 'Sikkim' },
	{ code: '12', name: 'Arunachal Pradesh' },
	{ code: '13', name: 'Nagaland' },
	{ code: '14', name: 'Manipur' },
	{ code: '15', name: 'Mizoram' },
	{ code: '16', name: 'Tripura' },
	{ code: '17', name: 'Meghalaya' },
	{ code: '18', name: 'Assam' },
	{ code: '19', name: 'West Bengal' },
	{ code: '20', name: 'Jharkhand' },
	{ code: '21', name: 'Odisha' },
	{ code: '22', name: 'Chhattisgarh' },
	{ code: '23', name: 'Madhya Pradesh' },
	{ code: '24', name: 'Gujarat' },
	{ code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
	{ code: '27', name: 'Maharashtra' },
	{ code: '29', name: 'Karnataka' },
	{ code: '30', name: 'Goa' },
	{ code: '31', name: 'Lakshadweep' },
	{ code: '32', name: 'Kerala' },
	{ code: '33', name: 'Tamil Nadu' },
	{ code: '34', name: 'Puducherry' },
	{ code: '35', name: 'Andaman and Nicobar Islands' },
	{ code: '36', name: 'Telangana' },
	{ code: '37', name: 'Andhra Pradesh' },
	{ code: '38', name: 'Ladakh' },
	{ code: '97', name: 'Other Territory' },
	{ code: '96', name: 'Outside India' }
];

export function stateName(code: string): string {
	for (const state of GST_STATES) {
		if (state.code === code) {
			return state.name;
		}
	}
	return '';
}

export function emptyParty(): InvoiceParty {
	return { name: '', address: '', gstin: '', stateCode: '', extraFields: [] };
}

export function emptyLine(): InvoiceLine {
	return {
		id: crypto.randomUUID(),
		description: '',
		sacCode: DEFAULT_SAC_CODE,
		amount: '',
		gstRate: DEFAULT_GST_RATE
	};
}

export function emptyInvoice(date: string): InvoiceDraft {
	return {
		number: '',
		date,
		taxType: 'auto',
		seller: emptyParty(),
		buyer: emptyParty(),
		lines: [emptyLine()],
		footer: ''
	};
}

// Today as YYYY-MM-DD in the given timezone (en-CA formats dates that way).
export function todayInTimezone(timezone: string): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

// "1,200.50" → 120050. Anything unparseable counts as 0 so the preview never
// shows NaN while the therapist is mid-typing.
export function parseAmountToPaise(text: string): number {
	const cleaned = text.replaceAll(',', '').trim();
	const value = Number(cleaned);
	if (cleaned === '' || Number.isNaN(value)) {
		return 0;
	}
	return Math.round(value * 100);
}

export function parseRate(text: string): number {
	const value = Number(text.trim());
	if (text.trim() === '' || Number.isNaN(value) || value < 0) {
		return 0;
	}
	return value;
}

// The buyer's state; with none known, GST places the supply in the seller's state.
export function placeOfSupply(draft: InvoiceDraft): string {
	if (draft.buyer.stateCode !== '') {
		return draft.buyer.stateCode;
	}
	return draft.seller.stateCode;
}

// Order from docs/invoice.md: explicit choice, then no seller GSTIN means no
// GST, then a supply inside the seller's state (incl. a buyer with no state)
// splits CGST/SGST, anything else (other state, outside India) is IGST.
export function resolveTaxType(draft: InvoiceDraft): TaxType {
	if (draft.taxType !== 'auto') {
		return draft.taxType;
	}
	if (draft.seller.gstin.trim() === '') {
		return 'none';
	}
	if (draft.seller.stateCode !== '' && draft.seller.stateCode === placeOfSupply(draft)) {
		return 'cgst_sgst';
	}
	return 'igst';
}

// Indian financial year (April–March) of a YYYY-MM-DD date: "2026-11-02" → "2026-27".
export function financialYearOf(date: string): string {
	const year = Number(date.slice(0, 4));
	const month = Number(date.slice(5, 7));
	let startYear = year;
	if (month < 4) {
		startYear = year - 1;
	}
	const endYear = String((startYear + 1) % 100).padStart(2, '0');
	return `${startYear}-${endYear}`;
}

// "ANV", "2026-27", 13 → "ANV/2026-27/0013"; no prefix → "2026-27/0013"
export function formatInvoiceNumber(
	prefix: string | null,
	financialYear: string,
	sequence: number
): string {
	const padded = String(sequence).padStart(4, '0');
	if (prefix) {
		return `${prefix}/${financialYear}/${padded}`;
	}
	return `${financialYear}/${padded}`;
}

// Amounts are GST-inclusive: back-calculate the taxable value and give the
// rest to tax so taxable + tax always equals what the client paid. An odd
// paisa on a CGST/SGST split goes to SGST.
export function computeLine(line: InvoiceLine, taxType: TaxType): ComputedLine {
	const totalPaise = parseAmountToPaise(line.amount);
	let gstRate = parseRate(line.gstRate);
	let taxablePaise = totalPaise;
	let cgstPaise = 0;
	let sgstPaise = 0;
	let igstPaise = 0;

	if (taxType === 'none') {
		gstRate = 0;
	} else {
		taxablePaise = Math.round((totalPaise * 100) / (100 + gstRate));
		const taxPaise = totalPaise - taxablePaise;
		if (taxType === 'cgst_sgst') {
			cgstPaise = Math.floor(taxPaise / 2);
			sgstPaise = taxPaise - cgstPaise;
		} else {
			igstPaise = taxPaise;
		}
	}

	return {
		id: line.id,
		description: line.description,
		sacCode: line.sacCode,
		gstRate,
		taxablePaise,
		cgstPaise,
		sgstPaise,
		igstPaise,
		totalPaise
	};
}

export function computeInvoice(draft: InvoiceDraft): ComputedInvoice {
	const taxType = resolveTaxType(draft);
	const lines: ComputedLine[] = [];
	let taxablePaise = 0;
	let cgstPaise = 0;
	let sgstPaise = 0;
	let igstPaise = 0;
	let totalPaise = 0;

	for (const line of draft.lines) {
		const computed = computeLine(line, taxType);
		lines.push(computed);
		taxablePaise += computed.taxablePaise;
		cgstPaise += computed.cgstPaise;
		sgstPaise += computed.sgstPaise;
		igstPaise += computed.igstPaise;
		totalPaise += computed.totalPaise;
	}

	let title = 'Tax Invoice';
	if (taxType === 'none') {
		title = 'Bill of Supply';
	}

	return { title, taxType, lines, taxablePaise, cgstPaise, sgstPaise, igstPaise, totalPaise };
}

// 120050 → "₹1,200.50"
export function formatRupees(paise: number): string {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		minimumFractionDigits: 2
	}).format(paise / 100);
}

// "2026-11-02" → "02 Nov 2026". Built from the parts so no timezone can shift the day.
export function formatInvoiceDate(date: string): string {
	const parts = date.split('-');
	if (parts.length !== 3) {
		return '';
	}
	const day = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
	if (Number.isNaN(day.getTime())) {
		return '';
	}
	return day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
