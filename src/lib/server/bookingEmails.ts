import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment, client, therapist, user } from '$lib/server/db/schema';
import { sendEmail } from '$lib/server/email';
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

		let meetLine = '';
		if (row.modality === 'online' && row.meetLink) {
			meetLine = `<p>Join here: <a href="${row.meetLink}">${row.meetLink}</a></p>`;
		}

		let subject: string;
		let body: string;
		if (kind === 'confirmed') {
			subject = 'Your session is booked';
			body = `<p>Your session with ${row.therapistName} is confirmed for ${when} (${modalityText}).</p>${meetLine}`;
		} else if (kind === 'cancelled') {
			subject = 'Your session was cancelled';
			body = `<p>Your session with ${row.therapistName} on ${when} has been cancelled.</p>${feeLine}`;
		} else {
			const from = extra.previousStartAt ? formatWhen(extra.previousStartAt, row.timezone) : null;
			subject = 'Your session was rescheduled';
			body = `<p>Your session with ${row.therapistName} has been moved${from ? ` from ${from}` : ''} to ${when} (${modalityText}).</p>${meetLine}${feeLine}`;
		}

		await sendEmail(row.clientEmail, subject, body);
	} catch (err) {
		console.error(`failed to send ${kind} email for appointment ${appointmentId}:`, err);
	}
}
