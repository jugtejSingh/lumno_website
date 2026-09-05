import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment, client, therapist, user } from '$lib/server/db/schema';
import { sendEmail, wrapEmail } from '$lib/server/email';
import { getNotificationSettings } from '$lib/server/settings';
import { formatCurrency } from '$lib/format';

type AppointmentEmailKind = 'confirmed' | 'cancelled' | 'rescheduled';

type AppointmentEmailExtra = {
	// > 0 when a cancellation/reschedule fee was charged (matches the payment row's note)
	feeAmount?: number;
	// the pre-reschedule start time, for the "moved from X to Y" line
	previousStartAt?: Date;
};

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

// Best-effort client notification for a booking/cancel/reschedule. Gated on the therapist's
// sendBookingEmails setting and on the client actually having an email (walk-ins don't).
// Never throws — a failed send is logged and the appointment is left as-is, same contract as
// the Google Calendar side-effects.
export async function sendAppointmentEmail(
	appointmentId: string,
	kind: AppointmentEmailKind,
	extra: AppointmentEmailExtra = {}
): Promise<void> {
	try {
		const [row] = await db
			.select({
				startAt: appointment.startAt,
				modality: appointment.modality,
				meetLink: appointment.meetLink,
				therapistId: appointment.therapistId,
				clientEmail: client.email,
				clientName: client.name,
				therapistName: user.name,
				therapistEmail: user.email,
				timezone: therapist.timezone,
				currency: therapist.currency
			})
			.from(appointment)
			.innerJoin(client, eq(appointment.clientId, client.id))
			.innerJoin(therapist, eq(appointment.therapistId, therapist.id))
			.innerJoin(user, eq(therapist.userId, user.id))
			.where(eq(appointment.id, appointmentId));
		if (!row || !row.clientEmail) return;

		const settings = await getNotificationSettings(row.therapistId);
		if (!settings.sendBookingEmails) return;

		const when = formatWhen(row.startAt, row.timezone);
		const modalityText = row.modality === 'online' ? 'Online' : 'In person';

		let feeLine = '';
		if (extra.feeAmount && extra.feeAmount > 0) {
			feeLine = `<p>A fee of ${formatCurrency(extra.feeAmount, row.currency)} applies.</p>`;
		}

		const cta =
			kind !== 'cancelled' && row.modality === 'online' && row.meetLink
				? { text: 'Join session', url: row.meetLink }
				: undefined;
		const footerNote = `Sent on behalf of ${row.therapistName}. Reply to this email to reach them directly.`;

		let subject: string;
		let heading: string;
		let bodyHtml: string;
		let text: string;
		if (kind === 'confirmed') {
			subject = 'Your session is booked';
			heading = 'Session confirmed';
			bodyHtml = `<p>Your session with ${row.therapistName} is confirmed for ${when} (${modalityText}).</p>`;
			text = `Your session with ${row.therapistName} is confirmed for ${when} (${modalityText}).${row.meetLink ? ` Join here: ${row.meetLink}` : ''}`;
		} else if (kind === 'cancelled') {
			subject = 'Your session was cancelled';
			heading = 'Session cancelled';
			bodyHtml = `<p>Your session with ${row.therapistName} on ${when} has been cancelled.</p>${feeLine}`;
			text = `Your session with ${row.therapistName} on ${when} has been cancelled.`;
		} else {
			const from = extra.previousStartAt ? formatWhen(extra.previousStartAt, row.timezone) : null;
			subject = 'Your session was rescheduled';
			heading = 'Session rescheduled';
			bodyHtml = `<p>Your session with ${row.therapistName} has been moved${from ? ` from ${from}` : ''} to ${when} (${modalityText}).</p>${feeLine}`;
			text = `Your session with ${row.therapistName} has been moved${from ? ` from ${from}` : ''} to ${when} (${modalityText}).${row.meetLink ? ` Join here: ${row.meetLink}` : ''}`;
		}

		const html = wrapEmail({ heading, bodyHtml, cta, footerNote });
		await sendEmail(row.clientEmail, subject, html, { text, replyTo: row.therapistEmail });
	} catch (err) {
		console.error(`failed to send ${kind} email for appointment ${appointmentId}:`, err);
	}
}
