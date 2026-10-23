import { and, eq, gt, isNull, lt, lte, or, sql } from 'drizzle-orm';
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
import { payment } from '$lib/server/db/payments.schema';
import { escapeHtml, sendEmail, wrapEmail } from '$lib/server/email';
import { logError } from '$lib/server/log';
import { isWhatsAppConfigured, sendWhatsAppTemplate } from '$lib/server/whatsapp';
import { formatCurrency, formatTime, formatWhen, ordinal } from '$lib/format';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// session_reminder's named params. Times are in the client's timezone when they've set
// one; otherwise the therapist's, and the message says so.
function sessionReminderParams(row: {
	startAt: Date;
	endAt: Date;
	modality: 'online' | 'in_person';
	therapistName: string;
	clientTimezone: string | null;
	therapistTimezone: string;
}): Record<string, string> {
	let timezone = row.therapistTimezone;
	let timezoneNote = " (your therapist's timezone)";
	if (row.clientTimezone) {
		timezone = row.clientTimezone;
		timezoneNote = '';
	}

	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).formatToParts(row.startAt);
	let weekday = '';
	let dayOfMonth = 0;
	let month = '';
	for (const part of parts) {
		if (part.type === 'weekday') {
			weekday = part.value;
		} else if (part.type === 'day') {
			dayOfMonth = Number(part.value);
		} else if (part.type === 'month') {
			month = part.value;
		}
	}

	let mode = 'in-person';
	if (row.modality === 'online') {
		mode = 'online';
	}

	return {
		therapist_name: row.therapistName,
		mode,
		day: weekday,
		date_text: `${ordinal(dayOfMonth)} of ${month}`,
		start_time: formatTime(row.startAt, timezone),
		end_time: formatTime(row.endAt, timezone) + timezoneNote
	};
}

type SessionReminderRow = {
	startAt: Date;
	endAt: Date;
	modality: 'online' | 'in_person';
	meetLink: string | null;
	clientName: string;
	clientTimezone: string | null;
	therapistName: string;
	therapistEmail: string;
	timezone: string;
};

async function sendSessionReminderWhatsApp(phone: string, row: SessionReminderRow): Promise<void> {
	await sendWhatsAppTemplate(phone, 'session_reminder', 'en', {
		header: { name: row.clientName },
		body: sessionReminderParams({
			startAt: row.startAt,
			endAt: row.endAt,
			modality: row.modality,
			therapistName: row.therapistName,
			clientTimezone: row.clientTimezone,
			therapistTimezone: row.timezone
		})
	});
}

async function sendSessionReminderEmail(email: string, row: SessionReminderRow): Promise<void> {
	const when = formatWhen(row.startAt, row.timezone);
	const modalityText = row.modality === 'online' ? 'Online' : 'In person';
	const portalUrl = `${env.ORIGIN}/portal`;
	// Online sessions keep "Join session" as the button (it's what they need at session
	// time) and get the portal as a body link; everything else gets the portal button.
	let cta = { text: 'Open Lumno', url: portalUrl };
	let portalLine = '';
	if (row.modality === 'online' && row.meetLink) {
		cta = { text: 'Join session', url: row.meetLink };
		portalLine = `<p><a href="${portalUrl}">Open your Lumno portal</a></p>`;
	}
	const html = wrapEmail({
		heading: 'Upcoming session reminder',
		bodyHtml: `<p>Reminder: your session with ${escapeHtml(row.therapistName)} is at ${when} (${modalityText}).</p>${portalLine}`,
		cta,
		footerNote: `Sent on behalf of ${row.therapistName}. Reply to this email to reach them directly.`
	});
	const text = `Reminder: your session with ${row.therapistName} is at ${when} (${modalityText}).${row.meetLink ? ` Join here: ${row.meetLink}` : ''} Portal: ${portalUrl}`;
	await sendEmail(email, 'Upcoming session reminder', html, {
		text,
		replyTo: row.therapistEmail
	});
}

// Fires the 24h-before session reminder. client.phone only ever holds a verified number
// (see phoneVerification.ts), so a client with one gets WhatsApp; if that send fails it's
// logged and the email goes instead. No phone → email. Gated on the therapist's
// sendSessionReminderEmails setting and on the client having a phone or an email
// (walk-ins have neither).
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
			endAt: appointment.endAt,
			modality: appointment.modality,
			meetLink: appointment.meetLink,
			clientEmail: client.email,
			clientPhone: client.phone,
			clientName: client.name,
			clientTimezone: client.timezone,
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
		if (!row.clientEmail && !row.clientPhone) continue;
		try {
			let sent = false;
			if (row.clientPhone && isWhatsAppConfigured()) {
				try {
					await sendSessionReminderWhatsApp(row.clientPhone, row);
					sent = true;
				} catch (err) {
					logError('reminderEmails.session', err, {
						appointmentId: row.appointmentId,
						channel: 'whatsapp'
					});
				}
			}
			if (!sent && row.clientEmail) {
				await sendSessionReminderEmail(row.clientEmail, row);
				sent = true;
			}
			if (!sent) continue;
			await db
				.update(appointment)
				.set({ [sentAtColumn]: new Date() })
				.where(eq(appointment.id, row.appointmentId));
		} catch (err) {
			logError('reminderEmails.session', err, { appointmentId: row.appointmentId });
		}
	}
}

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

type PaymentReminderRow = {
	clientName: string;
	therapistName: string;
	therapistEmail: string;
};

// payment_reminders: header "Hey {{1}}", body "Your total payment of {{1}} is due for {{2}}..."
async function sendPaymentReminderWhatsApp(
	phone: string,
	amount: string,
	row: PaymentReminderRow
): Promise<void> {
	await sendWhatsAppTemplate(phone, 'payment_reminders', 'en', {
		header: [row.clientName],
		body: [amount, row.therapistName]
	});
}

async function sendPaymentReminderEmail(
	email: string,
	amount: string,
	row: PaymentReminderRow
): Promise<void> {
	const url = `${env.ORIGIN}/portal`;
	const html = wrapEmail({
		heading: 'Payment reminder',
		bodyHtml: `<p>You have an outstanding balance of ${amount} with ${escapeHtml(row.therapistName)}.</p>`,
		cta: { text: 'Open Lumno', url },
		footerNote: `Sent on behalf of ${row.therapistName}. Reply to this email to reach them directly.`
	});
	await sendEmail(email, 'Payment reminder', html, {
		text: `You have an outstanding balance of ${amount} with ${row.therapistName}.

${url}`,
		replyTo: row.therapistEmail
	});
}

// Nags clients with an outstanding balance, throttled to once every 7 days per client via
// lastPaymentReminderAt. Same channel choice as session reminders: WhatsApp if the client
// has a (verified) phone, email if they don't or the WhatsApp send fails. Gated on the
// therapist's sendPaymentReminderEmails setting and on the client having a phone or an
// email (walk-ins have no client row to nag). Never throws.
export async function sendPaymentReminders(): Promise<void> {
	const cooldownCutoff = new Date(Date.now() - WEEK_MS);

	const owedByClient = await db
		.select({
			clientId: client.id,
			owed: sql<number>`
				coalesce((select sum(${payment.amount}) from ${payment}
					left join ${appointment} on ${appointment.id} = ${payment.appointmentId}
					where ${payment.clientId} = ${client.id} and ${payment.status} = 'unpaid'
					and (${payment.appointmentId} is null
						or ${appointment.status} = 'cancelled'
						or ${appointment.endAt} <= now())), 0)			`.mapWith(Number),
			clientEmail: client.email,
			clientPhone: client.phone,
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
				or(isNull(client.lastPaymentReminderAt), lte(client.lastPaymentReminderAt, cooldownCutoff))
			)
		);

	// ponytail: same sequential tradeoff as sendSessionReminders — fine at low volume.
	for (const row of owedByClient) {
		if (!row.clientEmail && !row.clientPhone) continue;
		if (row.owed <= 0) continue;
		try {
			const amount = formatCurrency(row.owed, row.currency);
			let sent = false;
			if (row.clientPhone && isWhatsAppConfigured()) {
				try {
					await sendPaymentReminderWhatsApp(row.clientPhone, amount, row);
					sent = true;
				} catch (err) {
					logError('reminderEmails.payment', err, { clientId: row.clientId, channel: 'whatsapp' });
				}
			}
			if (!sent && row.clientEmail) {
				await sendPaymentReminderEmail(row.clientEmail, amount, row);
				sent = true;
			}
			if (!sent) continue;
			await db
				.update(client)
				.set({ lastPaymentReminderAt: new Date() })
				.where(eq(client.id, row.clientId));
		} catch (err) {
			logError('reminderEmails.payment', err, { clientId: row.clientId });
		}
	}
}

// Nags clients who've gone quiet: 14 days after their last (or only-ever-known) session,
// once more at 28 days, then stops — off client.lastSessionAt, which
// createAppointmentForTherapist keeps as the latest known startAt (future or past). A
// future lastSessionAt means they already have something booked, so this query only looks
// at rows in the past. Gated on the therapist's sendRebookReminderEmails setting and on
// the client having an email. Never throws.
export async function sendRebookReminders(): Promise<void> {
	const now = new Date();

	const rows = await db
		.select({
			clientId: client.id,
			clientEmail: client.email,
			stage: client.rebookReminderStage,
			lastReminderAt: client.lastRebookReminderAt,
			lastSessionAt: client.lastSessionAt,
			therapistName: user.name,
			therapistEmail: user.email
		})
		.from(client)
		.innerJoin(therapist, eq(client.therapistId, therapist.id))
		.innerJoin(user, eq(therapist.userId, user.id))
		.innerJoin(therapistSettings, eq(therapistSettings.therapistId, therapist.id))
		.where(
			and(
				eq(client.status, 'active'),
				eq(therapistSettings.sendRebookReminderEmails, true),
				lt(client.lastSessionAt, now)
			)
		);

	// ponytail: same sequential tradeoff as sendSessionReminders — fine at low volume.
	for (const row of rows) {
		if (!row.clientEmail || !row.lastSessionAt) continue;
		try {
			const daysSinceSession = (now.getTime() - row.lastSessionAt.getTime()) / DAY_MS;

			// auto-reset: a session since the last reminder means they've already come
			// back, so the ladder restarts from 0 without a separate write for it.
			let effectiveStage = row.stage;
			if (row.stage > 0 && row.lastReminderAt && row.lastSessionAt > row.lastReminderAt) {
				effectiveStage = 0;
			}

			let targetStage = 0;
			if (daysSinceSession >= 28) {
				targetStage = 2;
			} else if (daysSinceSession >= 14) {
				targetStage = 1;
			}

			// each stage is sent once; after stage 2 nothing more until they book again
			if (targetStage <= effectiveStage) continue;

			const bodyText =
				targetStage === 1
					? `It's been a couple of weeks since your last session with ${row.therapistName} — want to grab your next one?`
					: `It's been a while since your last session with ${row.therapistName}. Want to book your next one?`;
			const url = `${env.ORIGIN}/portal`;
			const html = wrapEmail({
				heading: 'Time to book your next session?',
				bodyHtml: `<p>${escapeHtml(bodyText)}</p>`,
				cta: { text: 'Book a session', url },
				footerNote: `Sent on behalf of ${row.therapistName}. Reply to this email to reach them directly.`
			});
			await sendEmail(row.clientEmail, 'Time to book your next session?', html, {
				text: `${bodyText}\n\n${url}`,
				replyTo: row.therapistEmail
			});
			await db
				.update(client)
				.set({ rebookReminderStage: targetStage, lastRebookReminderAt: now })
				.where(eq(client.id, row.clientId));
		} catch (err) {
			logError('reminderEmails.rebook', err, { clientId: row.clientId });
		}
	}
}
