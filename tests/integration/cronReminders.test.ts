import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendSessionRemindersMock = vi.fn().mockResolvedValue(undefined);
const sendPaymentRemindersMock = vi.fn().mockResolvedValue(undefined);
const sendRebookRemindersMock = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/reminderEmails', () => ({
	sendSessionReminders: sendSessionRemindersMock,
	sendPaymentReminders: sendPaymentRemindersMock,
	sendRebookReminders: sendRebookRemindersMock
}));

const refreshExpiringConnectionsMock = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/razorpayConnection', () => ({
	refreshExpiringConnections: refreshExpiringConnectionsMock
}));

const sweepStaleOrdersMock = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/sessionPayments', () => ({
	sweepStaleOrders: sweepStaleOrdersMock
}));

const materialiseReservedSlotsMock = vi.fn().mockResolvedValue({ created: 0, failed: 0 });
vi.mock('$lib/server/recurringBookings', () => ({
	materialiseReservedSlots: materialiseReservedSlotsMock
}));

const { GET } = await import('../../src/routes/api/cron/reminders/+server');

function request(authHeader: string | null) {
	const headers = new Headers();
	if (authHeader !== null) {
		headers.set('authorization', authHeader);
	}
	return { headers } as unknown as Request;
}

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	process.env.CRON_SECRET = originalSecret;
});

describe('GET /api/cron/reminders', () => {
	it('rejects the literal "Bearer undefined" fallback when CRON_SECRET is unset', async () => {
		delete process.env.CRON_SECRET;
		await expect(
			GET({ request: request('Bearer undefined') } as never)
		).rejects.toMatchObject({ status: 401 });
		expect(sendSessionRemindersMock).not.toHaveBeenCalled();
	});

	it('rejects a missing/wrong secret when CRON_SECRET is set', async () => {
		process.env.CRON_SECRET = 'real-secret';
		await expect(GET({ request: request(null) } as never)).rejects.toMatchObject({ status: 401 });
		await expect(
			GET({ request: request('Bearer wrong') } as never)
		).rejects.toMatchObject({ status: 401 });
	});

	it('runs all jobs when the bearer secret matches', async () => {
		process.env.CRON_SECRET = 'real-secret';
		const res = await GET({ request: request('Bearer real-secret') } as never);
		expect(res.status).toBe(200);
		expect(sendSessionRemindersMock).toHaveBeenCalledOnce();
		expect(sendPaymentRemindersMock).toHaveBeenCalledOnce();
		expect(sendRebookRemindersMock).toHaveBeenCalledOnce();
		expect(refreshExpiringConnectionsMock).toHaveBeenCalledOnce();
		expect(sweepStaleOrdersMock).toHaveBeenCalledOnce();
		expect(materialiseReservedSlotsMock).toHaveBeenCalledOnce();
	});

	it('still runs the other jobs, and reports 500, when the reserved-slot job throws', async () => {
		process.env.CRON_SECRET = 'real-secret';
		materialiseReservedSlotsMock.mockRejectedValueOnce(new Error('boom'));
		const res = await GET({ request: request('Bearer real-secret') } as never);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.jobs.reservedSlots).toBe('failed');
		expect(body.jobs.sessionReminders).toBe('ok');
		expect(sendSessionRemindersMock).toHaveBeenCalledOnce();
	});
});
