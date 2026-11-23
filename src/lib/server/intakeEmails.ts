import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { therapist, user } from '$lib/server/db/schema';
import { escapeHtml, sendEmail, wrapEmail } from '$lib/server/email';
import { logError } from '$lib/server/log';

export type IntakeEmailInput = {
	therapistId: string;
	responseId: string;
	name: string | null;
	email: string | null;
	createdAt: Date;
};

// Tells the therapist someone filled in their intake form. Deliberately carries no answers —
// they're often health information and inboxes get forwarded; the answers stay behind login.
// Best-effort, never throws: the response is already saved (same contract as bookingEmails.ts).
export async function sendIntakeResponseEmail(input: IntakeEmailInput): Promise<void> {
	try {
		const [row] = await db
			.select({ email: user.email, timezone: therapist.timezone })
			.from(therapist)
			.innerJoin(user, eq(therapist.userId, user.id))
			.where(eq(therapist.id, input.therapistId));
		if (!row) {
			return;
		}

		let from = '';
		if (input.name) {
			from = input.name;
		} else if (input.email) {
			from = input.email;
		}

		let subject = 'New intake response';
		let fromLine = 'Someone filled in your intake form';
		if (from) {
			subject = `New intake response from ${from}`;
			fromLine = `${from} filled in your intake form`;
		}

		const when = input.createdAt.toLocaleString('en-US', {
			timeZone: row.timezone,
			dateStyle: 'medium',
			timeStyle: 'short'
		});
		const url = `${env.ORIGIN}/intake/${input.responseId}`;

		await sendEmail(
			row.email,
			subject,
			wrapEmail({
				heading: 'New intake response',
				bodyHtml: `<p>${escapeHtml(fromLine)} on ${escapeHtml(when)}.</p><p>Log in to read their answers.</p>`,
				cta: { text: 'View response', url }
			}),
			{ text: `${fromLine} on ${when}.\nView it: ${url}` }
		);
	} catch (err) {
		logError('intakeEmails.sendIntakeResponseEmail', err);
	}
}
