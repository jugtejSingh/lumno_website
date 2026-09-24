import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client } from '$lib/server/db/schema';
import { sendRebookReminders } from '$lib/server/reminderEmails';
import { createAppointmentForTherapist } from '$lib/server/appointments';
import { resetDb, mkTherapist, mkClient } from './helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
	await resetDb();
});

async function setLastSessionAt(clientId: string, at: Date) {
	await db.update(client).set({ lastSessionAt: at }).where(eq(client.id, clientId));
}

async function getClient(clientId: string) {
	const [row] = await db.select().from(client).where(eq(client.id, clientId));
	return row;
}

describe('sendRebookReminders', () => {
	it('sends the stage-1 nudge at 4 days and records it', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id, { email: 'client@example.com' });
		await setLastSessionAt(c.id, new Date(Date.now() - 5 * DAY_MS));

		await sendRebookReminders();

		const row = await getClient(c.id);
		expect(row.rebookReminderStage).toBe(1);
		expect(row.lastRebookReminderAt).not.toBeNull();
	});

	it('does not nudge a client whose last known session is still in the future', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id, { email: 'client@example.com' });
		await setLastSessionAt(c.id, new Date(Date.now() + 3 * DAY_MS));

		await sendRebookReminders();

		const row = await getClient(c.id);
		expect(row.rebookReminderStage).toBe(0);
	});

	it('does not re-send stage 1 or advance to stage 2 before 11 days', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id, { email: 'client@example.com' });
		await db
			.update(client)
			.set({
				lastSessionAt: new Date(Date.now() - 6 * DAY_MS),
				rebookReminderStage: 1,
				lastRebookReminderAt: new Date(Date.now() - 2 * DAY_MS)
			})
			.where(eq(client.id, c.id));

		await sendRebookReminders();

		const row = await getClient(c.id);
		expect(row.rebookReminderStage).toBe(1);
	});

	it('advances to stage 2 at 11 days', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id, { email: 'client@example.com' });
		await db
			.update(client)
			.set({
				lastSessionAt: new Date(Date.now() - 12 * DAY_MS),
				rebookReminderStage: 1,
				lastRebookReminderAt: new Date(Date.now() - 8 * DAY_MS)
			})
			.where(eq(client.id, c.id));

		await sendRebookReminders();

		const row = await getClient(c.id);
		expect(row.rebookReminderStage).toBe(2);
	});

	it('repeats stage 2 every 14 days and not sooner', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id, { email: 'client@example.com' });
		await db
			.update(client)
			.set({
				lastSessionAt: new Date(Date.now() - 20 * DAY_MS),
				rebookReminderStage: 2,
				lastRebookReminderAt: new Date(Date.now() - 5 * DAY_MS)
			})
			.where(eq(client.id, c.id));

		await sendRebookReminders();
		let row = await getClient(c.id);
		const unchangedReminderAt = row.lastRebookReminderAt;
		expect(row.rebookReminderStage).toBe(2);

		await db
			.update(client)
			.set({ lastRebookReminderAt: new Date(Date.now() - 15 * DAY_MS) })
			.where(eq(client.id, c.id));

		await sendRebookReminders();
		row = await getClient(c.id);
		expect(row.lastRebookReminderAt).not.toEqual(unchangedReminderAt);
	});
});

describe('createAppointmentForTherapist — client.lastSessionAt', () => {
	it('sets lastSessionAt on the client from the booked startAt', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id);

		const result = await createAppointmentForTherapist(t.id, {
			clientId: c.id,
			year: 2027,
			month: 10,
			day: 5,
			startHour: 10,
			startMinute: 0,
			endHour: 11,
			endMinute: 0,
			modality: 'online'
		});
		expect('appointment' in result).toBe(true);

		const row = await getClient(c.id);
		expect(row.lastSessionAt).not.toBeNull();
	});

	it('keeps the later date when a subsequent booking is earlier', async () => {
		const t = await mkTherapist();
		const c = await mkClient(t.id);

		await createAppointmentForTherapist(t.id, {
			clientId: c.id,
			year: 2027,
			month: 10,
			day: 7,
			startHour: 10,
			startMinute: 0,
			endHour: 11,
			endMinute: 0,
			modality: 'online'
		});
		const afterFirst = await getClient(c.id);

		await createAppointmentForTherapist(t.id, {
			clientId: c.id,
			year: 2027,
			month: 10,
			day: 5,
			startHour: 10,
			startMinute: 0,
			endHour: 11,
			endMinute: 0,
			modality: 'online'
		});
		const afterSecond = await getClient(c.id);

		expect(afterSecond.lastSessionAt).toEqual(afterFirst.lastSessionAt);
	});
});
