import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoice, therapist, user } from '$lib/server/db/schema';
import { escapeHtml, sendEmail, wrapEmail } from '$lib/server/email';
import { getInvoice } from '$lib/server/invoices';
import { renderInvoicePdf } from '$lib/server/invoicePdf';

// Renders the PDF and emails it. Runs only inside /api/internal/invoice-email
// (its own 2 GB function, so the rest of the app doesn't load Chromium).
// Invoices go by email only, never WhatsApp.

export type SendInvoiceResult = { ok: true } | { ok: false; reason: 'not_found' | 'cancelled' };

export async function sendInvoiceEmail(
	therapistId: string,
	invoiceId: string,
	to: string
): Promise<SendInvoiceResult> {
	// every send re-checks the invoice belongs to this therapist
	const row = await getInvoice(therapistId, invoiceId);
	if (!row) {
		return { ok: false, reason: 'not_found' };
	}
	if (row.status === 'cancelled') {
		return { ok: false, reason: 'cancelled' };
	}

	const [owner] = await db
		.select({ email: user.email })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(therapist.id, therapistId));

	const pdf = await renderInvoicePdf(row);
	const sellerName = row.data.seller.name;
	const subject = `Invoice ${row.number} from ${sellerName}`;
	const html = wrapEmail({
		heading: `Invoice ${row.number}`,
		bodyHtml: `<p style="margin:0;">Please find attached invoice ${escapeHtml(row.number)} from ${escapeHtml(sellerName)}.</p>`,
		footerNote: 'Reply to this email to reach your practitioner directly.'
	});
	// "ANV/2026-27/0001" → "ANV-2026-27-0001.pdf"
	const filename = `${row.number.replaceAll('/', '-')}.pdf`;

	let replyTo: string | undefined = undefined;
	if (owner) {
		replyTo = owner.email;
	}
	await sendEmail(to, subject, html, {
		text: `Please find attached invoice ${row.number} from ${sellerName}.`,
		replyTo,
		attachments: [{ filename, content: Buffer.from(pdf) }]
	});

	await db
		.update(invoice)
		.set({ sentTo: to, sentAt: new Date() })
		.where(and(eq(invoice.id, invoiceId), eq(invoice.therapistId, therapistId)));
	return { ok: true };
}
