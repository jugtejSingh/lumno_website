import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	appointment,
	client,
	therapist,
	therapistRazorpayConnection,
	therapistSettings,
	user
} from '$lib/server/db/schema';
import { payment, paymentPack } from '$lib/server/db/payments.schema';
import { sendEmail, wrapEmail } from '$lib/server/email';
import { formatCurrency } from '$lib/format';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function formatWhen(at: Date, timezone: string): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(at);
}

// Fires the 24h-before session reminder email. Gated on the therapist's
// sendSessionReminderEmails setting and on the client having an email (walk-ins don't).
// Dedup is per-appointment via reminder24hSentAt, so a daily cron tick can't double-send;
// the window is a full 24h wide so a once-a-day run can't miss an appointment either.
// Never throws — a failed send is logged and left for the next tick.
export async function sendSessionReminders(): Promise<void> {
	const now = new Date();
	await sendSessionReminderBatch('reminder24hSentAt', new Date(now.getTime() + DAY_MS), now);
	// 1h-before reminder needs a cron finer than once/day (Hobby plan limit) to be timely.
	// Re-enable once on a plan that allows a */15 * * * * schedule.
	// await sendSessionReminderBatch('reminder1hSentAt', new Date(now.getTime() + 60 * 60 * 1000), now);
}

async function sendSessionReminderBatch(
	sentAtColumn: 'reminder24hSentAt' | 'reminder1hSentAt',
	windowEnd: Date,
	now: Date
): Promise<void> {
	const rows = await db
		.select({
			appointmentId: appointment.id,
			startAt: appointment.startAt,
			modality: appointment.modality,
			meetLink: appointment.meetLink,
			clientEmail: client.email,
			clientName: client.name,
			therapistName: user.name,
			therapistEmail: user.email,
			timezone: therapist.timezone
		})
		.from(appointment)
		.innerJoin(client, eq(appointment.clientId, client.id))
		.innerJoin(therapist, eq(appointment.therapistId, therapist.id))
		.innerJoin(user, eq(therapist.userId, user.id))
		.innerJoin(therapistSettings, eq(therapistSettings.therapistId, therapist.id))
		.where(
			and(
				eq(appointment.status, 'confirmed'),
				gt(appointment.startAt, now),
				lte(appointment.startAt, windowEnd),
				isNull(appointment[sentAtColumn]),
				eq(therapistSettings.sendSessionReminderEmails, true)
			)
		);

	// ponytail: sequential loop, one request+db write per reminder. Fine at low volume;
	// if this ever needs to handle hundreds of sends per tick, batch via Resend's batch
	// send endpoint or bound concurrency with Promise.all, and raise vercel.json maxDuration.
	for (const row of rows) {
		if (!row.clientEmail) continue;
		try {
			const when = formatWhen(row.startAt, row.timezone);
			const modalityText = row.modality === 'online' ? 'Online' : 'In person';
			const cta =
				row.modality === 'online' && row.meetLink
					? { text: 'Join session', url: row.meetLink }
					: undefined;
			const html = wrapEmail({
				heading: 'Upcoming session reminder',
				bodyHtml: `<p>Reminder: your session with ${row.therapistName} is at ${when} (${modalityText}).</p>`,
				cta,
				footerNote: `Sent on behalf of ${row.therapistName}. Reply to this email to reach them directly.`
			});
			const text = `Reminder: your session with ${row.therapistName} is at ${when} (${modalityText}).${row.meetLink ? ` Join here: ${row.meetLink}` : ''}`;
			await sendEmail(row.clientEmail, 'Upcoming session reminder', html, {
				text,
				replyTo: row.therapistEmail
			});
			await db
				.update(appointment)
				.set({ [sentAtColumn]: new Date() })
				.where(eq(appointment.id, row.appointmentId));
		} catch (err) {
			console.error(`failed to send session reminder for appointment ${row.appointmentId}:`, err);
		}
	}
}

// Nags clients with an outstanding balance, throttled to once every 7 days per client via
// lastPaymentReminderAt. Gated on the therapist's sendPaymentReminderEmails setting and on
// the client having an email (walk-ins have no client row to nag). Never throws.
// Failure-driven reconnect nudge: the authorization_revoked webhook (Phase 2) and,
// later, getAccessToken hitting a 4xx on refresh (Phase 3). Throttled off
// reconnectEmailSentAt so a therapist whose token died isn't emailed on every
// cron tick. storeConnection clears the timestamp on a successful reconnect.
export async function sendRazorpayReconnectEmail(
	therapistId: string,
	reason: 'revoked' | 'refresh_failed'
): Promise<void> {
	const [row] = await db
		.select({
			email: user.email,
			sentAt: therapistRazorpayConnection.reconnectEmailSentAt
		})
		.from(therapistRazorpayConnection)
		.innerJoin(therapist, eq(therapist.id, therapistRazorpayConnection.therapistId))
		.innerJoin(user, eq(user.id, therapist.userId))
		.where(eq(therapistRazorpayConnection.therapistId, therapistId));

	if (!row || !row.email) {
		return;
	}
	if (row.sentAt && Date.now() - row.sentAt.getTime() < DAY_MS) {
		return;
	}

	// Link to the settings page, not the OAuth kick-off endpoint: a logged-out
	// therapist gets bounced to /login with no return-to, and a bare +server route
	// is a dead end after that. The settings banner carries the Reconnect link.
	const url = `${env.ORIGIN}/settings`;
	const lead =
		reason === 'revoked'
			? 'Your Razorpay account was disconnected from Lumno, so clients can no longer pay their invoices in the portal.'
			: 'Lumno lost access to your Razorpay account, so clients can no longer pay their invoices in the portal.';
	const html = wrapEmail({
		heading: 'Reconnect Razorpay to resume portal payments',
		bodyHtml: `<p>${lead}</p><p>Open Settings and choose <strong>Reconnect</strong> under Payments. It takes a few seconds and restores portal payments right away. Existing invoices are unaffected — clients can still pay you directly in the meantime.</p>`,
		cta: { text: 'Open Settings', url }
	});
	await sendEmail(row.email, 'Reconnect Razorpay to resume portal payments', html, {
		text: `${lead}\n\nOpen Settings and choose Reconnect under Payments: ${url}`
	});
	await db
		.update(therapistRazorpayConnection)
		.set({ reconnectEmailSentAt: new Date() })
		.where(eq(therapistRazorpayConnection.therapistId, therapistId));
}

export async function sendPaymentReminders(): Promise<void> {
	const cooldownCutoff = new Date(Date.now() - WEEK_MS);

	const owedByClient = await db
		.select({
			clientId: client.id,
			owed: sql<number>`
				coalesce((select sum(${payment.amount}) from ${payment}
					where ${payment.clientId} = ${client.id} and ${payment.status} = 'unpaid'), 0)
				+ coalesce((select sum(${paymentPack.amount}) from ${paymentPack}
					where ${paymentPack.clientId} = ${client.id} and ${paymentPack.status} = 'pending_payment'), 0)
			`.mapWith(Number),
			clientEmail: client.email,
			clientName: client.name,
			currency: therapist.currency,
			therapistName: user.name,
			therapistEmail: user.email
		})
		.from(client)
		.innerJoin(therapist, eq(client.therapistId, therapist.id))
		.innerJoin(user, eq(therapist.userId, user.id))
		.innerJoin(therapistSettings, eq(therapistSettings.therapistId, therapist.id))
		.where(
			and(
				eq(therapistSettings.sendPaymentReminderEmails, true),
				sql`(${client.lastPaymentReminderAt} is null or ${client.lastPaymentReminderAt} <= ${cooldownCutoff})`
			)
		);

	// ponytail: same sequential tradeoff as sendSessionReminders — fine at low volume.
	for (const row of owedByClient) {
		if (!row.clientEmail || row.owed <= 0) continue;
		try {
			const amount = formatCurrency(row.owed, row.currency);
			const html = wrapEmail({
				heading: 'Payment reminder',
				bodyHtml: `<p>You have an outstanding balance of ${amount} with ${row.therapistName}.</p>`,
				footerNote: `Sent on behalf of ${row.therapistName}. Reply to this email to reach them directly.`
			});
			await sendEmail(row.clientEmail, 'Payment reminder', html, {
				text: `You have an outstanding balance of ${amount} with ${row.therapistName}.`,
				replyTo: row.therapistEmail
			});
			await db
				.update(client)
				.set({ lastPaymentReminderAt: new Date() })
				.where(eq(client.id, row.clientId));
		} catch (err) {
			console.error(`failed to send payment reminder for client ${row.clientId}:`, err);
		}
	}
}
