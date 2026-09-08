export type ClientBalance = {
	clientId: string;
	name: string;
	owed: number;
};

export type ClientOption = { id: string; name: string };

export type PackExhaustedAction = 'block_booking' | 'require_single_payment';

// Mirrors payments.ts's ClientPaymentHistoryRow — redeclared here because $lib/server
// modules can't be imported into client components. Dates arrive as ISO strings, not
// Date objects, once they've been through the GET endpoint's JSON response.
export type ClientPaymentHistoryRow = {
	id: string;
	amount: number;
	note: string | null;
	status: 'unpaid' | 'paid';
	createdAt: string;
	appointmentStartAt: string | null;
	appointmentModality: 'online' | 'in_person' | null;
};

export type ClientPaymentTotals = { owed: number; paidThisMonth: number; paidThisYear: number };
