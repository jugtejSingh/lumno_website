import { env } from '$env/dynamic/private';
import { Resend } from 'resend';

const resend = new Resend(env.RESEND_API);

const BRAND = '#96435f';
const BG = '#faf7f2';
const TEXT = '#2b2420';
const MUTED = '#7a6f63';
const BORDER = '#e8dfd3';

// Anything user-typed (names, links) goes through this before landing in email HTML.
export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

// heading, cta and footerNote are plain text and escaped here; bodyHtml is HTML,
// so callers escape whatever they interpolate into it.
// Shared table-based, inline-styled layout so every transactional email looks like it
// came from the same product instead of a bare paragraph + link.
export function wrapEmail(opts: {
	heading: string;
	bodyHtml: string;
	cta?: { text: string; url: string };
	footerNote?: string;
}): string {
	const ctaHtml = opts.cta
		? `<p style="margin:24px 0 4px;"><a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:${BRAND};color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:8px;">${escapeHtml(opts.cta.text)}</a></p>`
		: '';
	const footerHtml = opts.footerNote
		? `<p style="margin:0 0 8px;">${escapeHtml(opts.footerNote)}</p>`
		: '';
	return `
<div style="background:${BG};padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
	<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;border-collapse:separate;overflow:hidden;">
		<tr><td style="padding:28px 32px 0;">
			<div style="font-size:20px;font-weight:700;color:${BRAND};letter-spacing:0.02em;">Lumno</div>
		</td></tr>
		<tr><td style="padding:16px 32px 8px;">
			<h1 style="margin:0 0 12px;font-size:18px;color:${TEXT};">${escapeHtml(opts.heading)}</h1>
			<div style="font-size:15px;line-height:1.6;color:${TEXT};">${opts.bodyHtml}</div>
			${ctaHtml}
		</td></tr>
		<tr><td style="padding:20px 32px 28px;border-top:1px solid ${BORDER};margin-top:8px;font-size:12px;line-height:1.5;color:${MUTED};">
			${footerHtml}
			<p style="margin:0;">Lumno &mdash; scheduling, payments, and notes for therapy practices.</p>
		</td></tr>
	</table>
</div>`.trim();
}

export async function sendEmail(
	to: string,
	subject: string,
	html: string,
	opts: { text?: string; replyTo?: string } = {}
) {
	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject,
		html,
		text: opts.text,
		replyTo: opts.replyTo
	});
	if (error) {
		// no recipient address in the message — it ends up in the logs
		throw new Error(`failed to send email: ${error.message}`);
	}
}
