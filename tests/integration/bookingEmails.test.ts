import { describe, it, expect, beforeEach, vi } from 'vitest';

// setup.ts stubs this module for every other test; here the real one runs (email is
// still stubbed) so the text it sends can be checked.
vi.unmock('$lib/server/bookingEmails');

const { sendEmail } = await import('$lib/server/email');
const { sendAppointmentEmail, sendGuestBookingEmail } = await import('$lib/server/bookingEmails');
const { resetDb, mkTherapist, mkClient, mkAppointment } = await import('./helpers');

// Friday 23 Oct 2026, 10:00 IST = 00:30 New York (EDT)
const SESSION_START = new Date('2026-10-23T04:30:00Z');
const SESSION_END = new Date('2026-10-23T05:30:00Z');

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
});

async function mkBooking(clientTimezone?: string) {
	const t = await mkTherapist();
	const c = await mkClient(t.id, { email: 'client@example.com', timezone: clientTimezone });
	const a = await mkAppointment(t.id, c.id, {
		startAt: SESSION_START,
		endAt: SESSION_END,
		status: 'confirmed'
	});
	return { therapistId: t.id, appointmentId: a.id };
}

// the plain-text body of the one email sent
function sentText(): string {
	const calls = vi.mocked(sendEmail).mock.calls;
	expect(calls).toHaveLength(1);
	const options = calls[0][3] as { text: string };
	return options.text;
}

describe('booking email times', () => {
	it("uses the client's timezone when they've set one, and names it", async () => {
		const { appointmentId } = await mkBooking('America/New_York');

		await sendAppointmentEmail(appointmentId, 'confirmed');

		expect(sentText()).toContain('Fri, Oct 23, 12:30 AM (Eastern Daylight Time)');
	});

	it("falls back to the therapist's timezone, and names it", async () => {
		const { appointmentId } = await mkBooking();

		await sendAppointmentEmail(appointmentId, 'confirmed');

		expect(sentText()).toContain('Fri, Oct 23, 10:00 AM (India Standard Time)');
	});

	it('writes both reschedule times in the same timezone', async () => {
		const { appointmentId } = await mkBooking('America/New_York');

		await sendAppointmentEmail(appointmentId, 'rescheduled', {
			previousStartAt: new Date('2026-10-22T04:30:00Z')
		});

		expect(sentText()).toContain(
			'moved from Thu, Oct 22, 12:30 AM (Eastern Daylight Time) to Fri, Oct 23, 12:30 AM (Eastern Daylight Time)'
		);
	});

	it("a cancellation uses the client's timezone too", async () => {
		const { appointmentId } = await mkBooking('Europe/London');

		await sendAppointmentEmail(appointmentId, 'cancelled');

		expect(sentText()).toContain('Fri, Oct 23, 5:30 AM (British Summer Time)');
	});

	it("a guest booking uses the therapist's timezone, named", async () => {
		const { appointmentId } = await mkBooking();

		await sendGuestBookingEmail(appointmentId, 'guest@example.com');

		expect(sentText()).toContain('Fri, Oct 23, 10:00 AM (India Standard Time)');
	});
});
