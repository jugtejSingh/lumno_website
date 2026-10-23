import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// Meta is replaced; email is already stubbed in setup.ts. These tests check which
// channel a reminder goes on and that it's marked sent exactly once.
const { sendWhatsAppTemplate, isWhatsAppConfigured } = vi.hoisted(() => ({
	sendWhatsAppTemplate: vi.fn(async () => {}),
	isWhatsAppConfigured: vi.fn(() => true)
}));
vi.mock('$lib/server/whatsapp', () => ({ sendWhatsAppTemplate, isWhatsAppConfigured }));
vi.mock('$lib/server/log', () => ({ logError: vi.fn() }));

const { db } = await import('$lib/server/db');
const { appointment, client } = await import('$lib/server/db/schema');
const { sendEmail } = await import('$lib/server/email');
const { sendSessionReminders, sendPaymentReminders } = await import('$lib/server/reminderEmails');
const { resetDb, mkTherapist, mkClient, mkAppointment, mkPayment } = await import('./helpers');

const PHONE = '+919876543210';
const EMAIL = 'client@example.com';

// Thursday 22 Oct 2026, 15:30 IST. The session below is the next morning, inside the
// 24h window, at 10:00 IST.
const NOW = new Date('2026-10-22T10:00:00Z');
const SESSION_START = new Date('2026-10-23T04:30:00Z');
const SESSION_END = new Date('2026-10-23T05:30:00Z');

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	// only Date is faked, so the postgres driver's timers keep working
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

async function mkSession(contact: {
	email?: string | null;
	phone?: string | null;
	timezone?: string;
}) {
	const t = await mkTherapist();
	const c = await mkClient(t.id, contact);
	const a = await mkAppointment(t.id, c.id, {
		startAt: SESSION_START,
		endAt: SESSION_END,
		status: 'confirmed'
	});
	return a.id;
}

async function sessionSentAt(appointmentId: string) {
	const [row] = await db
		.select({ sentAt: appointment.reminder24hSentAt })
		.from(appointment)
		.where(eq(appointment.id, appointmentId));
	return row.sentAt;
}

async function mkOwingClient(contact: { email?: string | null; phone?: string | null }) {
	const t = await mkTherapist();
	const c = await mkClient(t.id, contact);
	await mkPayment(t.id, c.id, { amount: 2000, status: 'unpaid' });
	return c.id;
}

async function paymentRemindedAt(clientId: string) {
	const [row] = await db
		.select({ at: client.lastPaymentReminderAt })
		.from(client)
		.where(eq(client.id, clientId));
	return row.at;
}

describe('session reminders', () => {
	it('a client with a phone gets WhatsApp and no email', async () => {
		const id = await mkSession({ email: EMAIL, phone: PHONE });

		await sendSessionReminders();

		expect(sendWhatsAppTemplate).toHaveBeenCalledTimes(1);
		expect(sendWhatsAppTemplate).toHaveBeenCalledWith(PHONE, 'session_reminder', 'en', {
			header: { name: 'Test Client' },
			body: {
				therapist_name: 'Test User',
				mode: 'online',
				day: 'Friday',
				date_text: '23rd of October',
				start_time: '10:00 AM',
				end_time: '11:00 AM (India Standard Time)'
			}
		});
		expect(sendEmail).not.toHaveBeenCalled();
		expect(await sessionSentAt(id)).not.toBeNull();
	});

	it("uses the client's own timezone when they've set one, and names it", async () => {
		await mkSession({ phone: PHONE, timezone: 'America/New_York' });

		await sendSessionReminders();

		const values = sendWhatsAppTemplate.mock.calls[0] as unknown as [
			string,
			string,
			string,
			{ body: Record<string, string> }
		];
		expect(values[3].body.start_time).toBe('12:30 AM');
		expect(values[3].body.end_time).toBe('1:30 AM (Eastern Daylight Time)');
		expect(values[3].body.day).toBe('Friday');
	});

	it('falls back to email when WhatsApp fails, and marks it sent once', async () => {
		const id = await mkSession({ email: EMAIL, phone: PHONE });
		sendWhatsAppTemplate.mockRejectedValueOnce(new Error('meta down'));

		await sendSessionReminders();
		await sendSessionReminders();

		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(sendWhatsAppTemplate).toHaveBeenCalledTimes(1);
		expect(await sessionSentAt(id)).not.toBeNull();
	});

	it('a client with no phone gets email', async () => {
		const id = await mkSession({ email: EMAIL });

		await sendSessionReminders();

		expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(await sessionSentAt(id)).not.toBeNull();
	});

	it("writes the email time in the client's timezone when set, otherwise the therapist's", async () => {
		await mkSession({ email: 'ny@example.com', timezone: 'America/New_York' });
		await mkSession({ email: 'ist@example.com' });

		await sendSessionReminders();

		const textByEmail: Record<string, string> = {};
		for (const call of vi.mocked(sendEmail).mock.calls) {
			textByEmail[call[0] as string] = JSON.stringify(call);
		}
		expect(textByEmail['ny@example.com']).toContain('12:30 AM (Eastern Daylight Time)');
		expect(textByEmail['ist@example.com']).toContain('10:00 AM (India Standard Time)');
	});

	it('goes by email when WhatsApp is not configured', async () => {
		isWhatsAppConfigured.mockReturnValue(false);
		await mkSession({ email: EMAIL, phone: PHONE });

		await sendSessionReminders();

		expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
		expect(sendEmail).toHaveBeenCalledTimes(1);
		isWhatsAppConfigured.mockReturnValue(true);
	});

	it('a phone-only client whose WhatsApp fails is left unmarked for the next tick', async () => {
		const id = await mkSession({ phone: PHONE });
		sendWhatsAppTemplate.mockRejectedValueOnce(new Error('meta down'));

		await sendSessionReminders();

		expect(sendEmail).not.toHaveBeenCalled();
		expect(await sessionSentAt(id)).toBeNull();
	});

	it('sends nothing to a client with neither phone nor email', async () => {
		const id = await mkSession({});

		await sendSessionReminders();

		expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
		expect(sendEmail).not.toHaveBeenCalled();
		expect(await sessionSentAt(id)).toBeNull();
	});
});

describe('payment reminders', () => {
	it('a client with a phone gets WhatsApp and no email', async () => {
		const id = await mkOwingClient({ email: EMAIL, phone: PHONE });

		await sendPaymentReminders();

		expect(sendWhatsAppTemplate).toHaveBeenCalledTimes(1);
		const values = sendWhatsAppTemplate.mock.calls[0] as unknown as [
			string,
			string,
			string,
			{ header: string[]; body: string[] }
		];
		expect(values[0]).toBe(PHONE);
		expect(values[1]).toBe('payment_reminders');
		expect(values[3].header).toEqual(['Test Client']);
		expect(values[3].body[0]).toContain('2,000');
		expect(values[3].body[1]).toBe('Test User');
		expect(sendEmail).not.toHaveBeenCalled();
		expect(await paymentRemindedAt(id)).not.toBeNull();
	});

	it('falls back to email when WhatsApp fails, and marks it sent once', async () => {
		const id = await mkOwingClient({ email: EMAIL, phone: PHONE });
		sendWhatsAppTemplate.mockRejectedValueOnce(new Error('meta down'));

		await sendPaymentReminders();
		await sendPaymentReminders();

		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(await paymentRemindedAt(id)).not.toBeNull();
	});

	it('a client with no phone gets email', async () => {
		const id = await mkOwingClient({ email: EMAIL });

		await sendPaymentReminders();

		expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(await paymentRemindedAt(id)).not.toBeNull();
	});

	it('sends nothing to a client with neither phone nor email', async () => {
		const id = await mkOwingClient({});

		await sendPaymentReminders();

		expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
		expect(sendEmail).not.toHaveBeenCalled();
		expect(await paymentRemindedAt(id)).toBeNull();
	});
});
