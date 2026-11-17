export type ClientBalance = {
	clientId: string;
	name: string;
	owed: number;
};

export type ClientOption = { id: string; name: string };

// Mirrors payments.ts's ClientPaymentHistoryRow — redeclared here because $lib/server
// modules can't be imported into client components. Dates arrive as ISO strings, not
// Date objects, once they've been through the GET endpoint's JSON response.
export type ClientPaymentHistoryRow = {
	id: string;
	amount: number;
	note: string | null;
	status: 'unpaid' | 'paid';
	paidVia: 'manual' | 'razorpay';
	createdAt: string;
	appointmentStartAt: string | null;
	appointmentModality: 'online' | 'in_person' | null;
	refundDue: number | null;
	refundFlagId: string | null;
	// the live refund on this payment, or the latest failed attempt; null when never refunded
	refund: PaymentRefundSummary | null;
};

// Mirrors paymentRefunds.ts's RefundSummary.
export type PaymentRefundSummary = {
	method: 'razorpay' | 'manual';
	amount: number;
	status: 'pending' | 'processed' | 'failed';
	failureReason: string | null;
};

export type ClientPaymentTotals = { owed: number; paidThisMonth: number; paidThisYear: number };
