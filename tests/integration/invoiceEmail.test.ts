import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Step 6a: invoice PDF email. Chromium and Resend are mocked; the email module
// is mocked globally in setup.ts. See docs/invoice.md.

vi.mock('$lib/server/invoicePdf', () => ({
	renderInvoicePdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70]))
}));

const sendCounts = new Map<string, number>();
vi.mock('$lib/server/rateLimit', () => ({
	invoiceEmailRatelimit: {
		limit: vi.fn(async (key: string) => {
			let used = sendCounts.get(key);
			if (used === undefined) {
				used = 0;
			}
			used = used + 1;
			sendCounts.set(key, used);
			return { success: used <= 3 };
		})
	}
}));

vi.mock('$lib/server/invoiceEmailRequest', () => ({
	requestInvoiceEmail: vi.fn(async () => 'sent')
}));

const { eq } = await import('drizzle-orm');
const { db } = await import('$lib/server/db');
const { invoice, invoiceSettings, clientBilling } = await import('$lib/server/db/schema');
const { issueInvoice, cancelInvoice } = await import('$lib/server/invoices');
const { invoiceRecipient } = await import('$lib/server/clientBilling');
const { sendEmail } = await import('$lib/server/email');
const { requestInvoiceEmail } = await import('$lib/server/invoiceEmailRequest');
const { POST } = await import('../../src/routes/api/internal/invoice-email/+server');
const { actions } = await import('../../src/routes/(app)/invoice/[id]/+page.server');
const { resetDb, mkTherapist, mkClient, mkPayment, mkEvent } = await import('./helpers');

let therapistId: string;
let therapistEmail: string;
let clientId: string;
const originalSecret = process.env.CRON_SECRET;

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	sendCounts.clear();
	process.env.CRON_SECRET = 'test-secret';
	const therapistRow = await mkTherapist({ currency: 'INR' });
	therapistId = therapistRow.id;
	therapistEmail = therapistRow.user.email;
	clientId = (await mkClient(therapistId, { name: 'Sam Client', email: 'sam@example.com' })).id;
	await db.insert(invoiceSettings).values({
		therapistId,
		address: '12 MG Road, Pune',
		stateCode: '27',
		numberPrefix: 'ANV'
	});
});

afterEach(() => {
	process.env.CRON_SECRET = originalSecret;
});

async function issue(): Promise<string> {
	const paymentRow = await mkPayment(therapistId, clientId, { amount: 1180 });
	const result = await issueInvoice(therapistId, paymentRow.id, {
		date: '2026-11-04',
		taxType: 'auto',
		buyer: { name: 'Sam Client', address: '', gstin: '', stateCode: '27' },
		lines: [{ id: 'a', description: 'Therapy session', sacCode: '9993', amount: '1180', gstRate: '18' }]
	});
	if (!result.ok) {
		throw new Error(`issue failed: ${result.reason}`);
	}
	return result.invoiceId;
}

function post(body: unknown, auth: string | null = 'Bearer test-secret') {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (auth !== null) {
		headers.set('authorization', auth);
	}
	const request = new Request('http://localhost/api/internal/invoice-email', {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});
	return POST({ request } as never);
}

async function status(promise: Promise<Response>): Promise<number> {
	try {
		const response = await promise;
		return response.status;
	} catch (err) {
		return (err as { status: number }).status;
	}
}

describe('invoice email endpoint', () => {
	it('needs the secret', async () => {
		const invoiceId = await issue();
		const body = { therapistId, invoiceId, to: 'a@example.com' };
		expect(await status(post(body, null))).toBe(401);
		expect(await status(post(body, 'Bearer wrong'))).toBe(401);
		delete process.env.CRON_SECRET;
		expect(await status(post(body, 'Bearer undefined'))).toBe(401);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('rejects a bad recipient', async () => {
		const invoiceId = await issue();
		expect(await status(post({ therapistId, invoiceId, to: 'not-an-email' }))).toBe(400);
	});

	it('emails the PDF and records sent_to / sent_at', async () => {
		const invoiceId = await issue();
		expect(await status(post({ therapistId, invoiceId, to: 'accounts@example.com' }))).toBe(200);

		expect(sendEmail).toHaveBeenCalledTimes(1);
		const call = vi.mocked(sendEmail).mock.calls[0];
		expect(call[0]).toBe('accounts@example.com');
		expect(call[1]).toMatch(/^Invoice ANV\/.+\/0001 from /);
		expect(call[3]?.replyTo).toBe(therapistEmail);
		expect(call[3]?.attachments?.[0].filename).toMatch(/^ANV-.+-0001\.pdf$/);

		const [row] = await db.select().from(invoice).where(eq(invoice.id, invoiceId));
		expect(row.sentTo).toBe('accounts@example.com');
		expect(row.sentAt).toBeInstanceOf(Date);
	});

	it("won't send another therapist's invoice", async () => {
		const invoiceId = await issue();
		const otherTherapistId = (await mkTherapist({ currency: 'INR' })).id;
		expect(await status(post({ therapistId: otherTherapistId, invoiceId, to: 'a@example.com' }))).toBe(404);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("won't send a cancelled invoice", async () => {
		const invoiceId = await issue();
		await cancelInvoice(therapistId, invoiceId);
		expect(await status(post({ therapistId, invoiceId, to: 'a@example.com' }))).toBe(409);
		expect(sendEmail).not.toHaveBeenCalled();
	});
});

describe('email action on /invoice/[id]', () => {
	function emailAction(invoiceId: string, to: string, asTherapist: string = therapistId) {
		const event = mkEvent({
			locals: { therapistId: asTherapist },
			params: { id: invoiceId },
			url: `http://localhost/invoice/${invoiceId}`,
			fields: { to }
		});
		return actions.email(event as never);
	}

	it('asks the sender function to email it', async () => {
		const invoiceId = await issue();
		const result = await emailAction(invoiceId, ' accounts@example.com ');
		expect(result).toEqual({ emailedTo: 'accounts@example.com' });
		expect(requestInvoiceEmail).toHaveBeenCalledWith('http://localhost', {
			therapistId,
			invoiceId,
			to: 'accounts@example.com'
		});
	});

	it('refuses the 4th send in an hour', async () => {
		const invoiceId = await issue();
		for (let attempt = 0; attempt < 3; attempt = attempt + 1) {
			expect(await emailAction(invoiceId, 'a@example.com')).toEqual({ emailedTo: 'a@example.com' });
		}
		const fourth = await emailAction(invoiceId, 'a@example.com');
		expect(fourth).toMatchObject({ status: 429 });
		expect(requestInvoiceEmail).toHaveBeenCalledTimes(3);
	});

	it('refuses an invalid email, a cancelled invoice and someone else’s invoice', async () => {
		const invoiceId = await issue();
		expect(await emailAction(invoiceId, 'nope')).toMatchObject({ status: 400 });

		const otherTherapistId = (await mkTherapist({ currency: 'INR' })).id;
		expect(await emailAction(invoiceId, 'a@example.com', otherTherapistId)).toMatchObject({ status: 404 });

		await cancelInvoice(therapistId, invoiceId);
		expect(await emailAction(invoiceId, 'a@example.com')).toMatchObject({ status: 409 });
		expect(requestInvoiceEmail).not.toHaveBeenCalled();
	});

	it('reports a failed send', async () => {
		const invoiceId = await issue();
		vi.mocked(requestInvoiceEmail).mockResolvedValueOnce('failed');
		expect(await emailAction(invoiceId, 'a@example.com')).toMatchObject({ status: 502 });
	});
});

describe('invoiceRecipient', () => {
	it('prefers the billing email, then the client email, else blank', async () => {
		expect(await invoiceRecipient(clientId)).toBe('sam@example.com');
		await db.insert(clientBilling).values({ clientId, billingEmail: 'accounts@acme.example' });
		expect(await invoiceRecipient(clientId)).toBe('accounts@acme.example');
		const noEmailClient = (await mkClient(therapistId, { name: 'No Email' })).id;
		expect(await invoiceRecipient(noEmailClient)).toBe('');
		expect(await invoiceRecipient(null)).toBe('');
	});
});
