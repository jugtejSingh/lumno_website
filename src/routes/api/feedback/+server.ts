import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { escapeHtml, sendEmail, wrapEmail } from '$lib/server/email';
import { feedbackRatelimit } from '$lib/server/rateLimit';

const SUPPORT_EMAIL = 'support@lumno.in';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readField(body: Record<string, unknown>, name: string, maxLength: number): string {
	const value = body[name];
	if (typeof value !== 'string') {
		error(400, `${name} is required`);
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		error(400, `${name} is required`);
	}
	if (trimmed.length > maxLength) {
		error(400, `${name} must be at most ${maxLength} characters`);
	}
	return trimmed;
}

// Feedback and issue reports, open to logged-in and logged-out users alike.
// Validation runs before the limiter so a typo doesn't burn the day's one send.
export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}
	if (body === null || typeof body !== 'object') {
		error(400, 'Invalid JSON body');
	}

	// Signed-in users send from their account email; only logged-out visitors type one.
	let email: string;
	if (locals.user) {
		email = locals.user.email;
	} else {
		email = readField(body, 'email', 254);
		if (!EMAIL_PATTERN.test(email)) {
			error(400, 'email is not a valid email address');
		}
	}
	const subject = readField(body, 'subject', 200);
	const message = readField(body, 'message', 5000);

	const { success } = await feedbackRatelimit.limit(getClientAddress());
	if (!success) {
		error(429, 'You can only send feedback once a day. Please try again tomorrow.');
	}

	// The typed email is unverified; the session tells us who actually sent it.
	let accountLine: string;
	if (locals.user) {
		accountLine = `Signed in as ${locals.user.email} (user ${locals.user.id})`;
	} else {
		accountLine = 'Not signed in';
	}

	const bodyHtml = `
		<p style="margin:0 0 4px;"><strong>From:</strong> ${escapeHtml(email)}</p>
		<p style="margin:0 0 16px;"><strong>Account:</strong> ${escapeHtml(accountLine)}</p>
		<p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>`;
	const text = `From: ${email}\nAccount: ${accountLine}\n\n${message}`;

	await sendEmail(
		SUPPORT_EMAIL,
		`Feedback: ${subject}`,
		wrapEmail({ heading: subject, bodyHtml }),
		{ text, replyTo: email }
	);

	return json({ ok: true });
};