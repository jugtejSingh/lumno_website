import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment, availabilitySlot, payment, paymentPack, client, clientNote } from '$lib/server/db/schema';
import { materialiseReservedSlots, deleteFutureHolds } from '$lib/server/recurringBookings';
import { setDateOverride } from '$lib/server/availabilitySlots';
import { saveWeekDay } from '$lib/server/weeklySlots';
import { getActivePackForClient } from '$lib/server/payments';
import { rescheduleAppointmentForTherapist } from '$lib/server/appointments';
import {
	resetDb,
	mkTherapist,
	mkClient,
	mkPack,
	mkPayment,
	mkAppointment,
	mkNote,
	mkSlot,
	dateAhead
} from './helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

let therapistId: string;
let clientId: string;

// The therapist is on UTC, so a slot at 10:00 is 10:00 UTC.
async function mkReservedSlot(
	weekday: number,
	overrides: Partial<typeof availabilitySlot.$inferInsert> = {}
) {
	return mkSlot(therapistId, { weekday, reservedClientId: clientId, ...overrides });
}

async function appointmentsFor(forClientId: string) {
	return db.select().from(appointment).where(eq(appointment.clientId, forClientId)).orderBy(appointment.startAt);
}

async function appointmentById(id: string) {
	const [row] = await db.select().from(appointment).where(eq(appointment.id, id));
	return row;
}

async function paymentById(id: string) {
	const [row] = await db.select().from(payment).where(eq(payment.id, id));
	return row;
}

async function packById(id: string) {
	const [row] = await db.select().from(paymentPack).where(eq(paymentPack.id, id));
	return row;
}

// A future confirmed hold on `slotId`, written straight to the table.
async function mkHold(slotId: string, daysAhead: number, overrides: Partial<typeof appointment.$inferInsert> = {}) {
	const date = dateAhead(daysAhead);
	return mkAppointment(therapistId, clientId, {
		startAt: date.at(10),
		endAt: date.at(11),
		slotId,
		...overrides
	});
}

// deleteFutureHolds always runs inside the caller's transaction
async function runDelete(slotId: string) {
	return db.transaction(async (tx) => {
		return deleteFutureHolds(tx, slotId);
	});
}

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ timezone: 'UTC' })).id;
	clientId = (await mkClient(therapistId, { rate: 1500 })).id;
});

describe('materialiseReservedSlots: booking', () => {
	it('books every matching weekday in the next 14 days at the slot time', async () => {
		const target = dateAhead(3);
		await mkReservedSlot(target.weekday);

		const result = await materialiseReservedSlots();

		const rows = await appointmentsFor(clientId);
		// a weekday occurs twice in any 14 day span (sometimes a third time at the edges is cut by time of day)
		expect(rows.length).toBeGreaterThanOrEqual(2);
		expect(rows.length).toBeLessThanOrEqual(3);
		expect(result.created).toBe(rows.length);
		expect(result.blocked).toBe(0);
		expect(result.failed).toBe(0);
		expect(rows[0].startAt.getTime()).toBe(target.at(10).getTime());
		expect(rows[0].endAt.getTime()).toBe(target.at(11).getTime());
		expect(rows[0].therapistId).toBe(therapistId);
		expect(rows[0].modality).toBe('online');
		expect(rows[0].status).toBe('confirmed');
		for (const row of rows) {
			expect(row.startAt.getUTCDay()).toBe(target.weekday);
			expect(row.startAt.getTime()).toBeGreaterThan(Date.now());
			expect(row.startAt.getTime()).toBeLessThanOrEqual(Date.now() + 14 * DAY_MS);
		}
	});

	it('sets slotId on every hold it books', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);

		await materialiseReservedSlots();

		const rows = await appointmentsFor(clientId);
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(row.slotId).toBe(slot.id);
		}
	});

	it('is idempotent: a second and third run create nothing', async () => {
		await mkReservedSlot(dateAhead(2).weekday);
		const first = await materialiseReservedSlots();
		const second = await materialiseReservedSlots();
		const third = await materialiseReservedSlots();

		expect(first.created).toBeGreaterThan(0);
		expect(second).toEqual({ created: 0, blocked: 0, failed: 0 });
		expect(third).toEqual({ created: 0, blocked: 0, failed: 0 });
		expect((await appointmentsFor(clientId)).length).toBe(first.created);
	});

	it('books nothing when no slot is reserved', async () => {
		await mkReservedSlot(dateAhead(2).weekday, { reservedClientId: null });
		const result = await materialiseReservedSlots();
		expect(result).toEqual({ created: 0, blocked: 0, failed: 0 });
		expect(await appointmentsFor(clientId)).toHaveLength(0);
	});

	it('honours the therapist timezone', async () => {
		const kolkata = await mkTherapist({ timezone: 'Asia/Kolkata' });
		const kolkataClient = await mkClient(kolkata.id);
		// 10:00 IST is 04:30 UTC. Book it on tomorrow's IST calendar date.
		const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
		const tomorrow = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + 1));
		await mkSlot(kolkata.id, { weekday: tomorrow.getUTCDay(), reservedClientId: kolkataClient.id });

		await materialiseReservedSlots();

		const rows = await appointmentsFor(kolkataClient.id);
		expect(rows.length).toBeGreaterThanOrEqual(2);
		const expected = Date.UTC(
			tomorrow.getUTCFullYear(),
			tomorrow.getUTCMonth(),
			tomorrow.getUTCDate(),
			4,
			30
		);
		expect(rows[0].startAt.getTime()).toBe(expected);
	});

	it('books an in-person slot as in person', async () => {
		await mkReservedSlot(dateAhead(4).weekday, { modality: 'in_person' });
		await materialiseReservedSlots();
		const rows = await appointmentsFor(clientId);
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(row.modality).toBe('in_person');
		}
	});

	it('handles several clients and therapists in one run', async () => {
		const otherClient = await mkClient(therapistId, { name: 'Second' });
		const otherTherapist = await mkTherapist({ timezone: 'UTC' });
		const thirdClient = await mkClient(otherTherapist.id, { name: 'Third' });

		await mkReservedSlot(dateAhead(2).weekday, { startTime: '10:00', endTime: '11:00' });
		await mkReservedSlot(dateAhead(3).weekday, {
			startTime: '14:00',
			endTime: '15:00',
			reservedClientId: otherClient.id
		});
		await mkSlot(otherTherapist.id, { weekday: dateAhead(2).weekday, reservedClientId: thirdClient.id });

		const result = await materialiseReservedSlots();

		const a = await appointmentsFor(clientId);
		const b = await appointmentsFor(otherClient.id);
		const c = await appointmentsFor(thirdClient.id);
		expect(a.length).toBeGreaterThanOrEqual(2);
		expect(b.length).toBeGreaterThanOrEqual(2);
		expect(c.length).toBeGreaterThanOrEqual(2);
		expect(result.created).toBe(a.length + b.length + c.length);
		// same wall-clock time, different therapists: never an overlap
		for (const row of c) {
			expect(row.therapistId).toBe(otherTherapist.id);
		}
	});

	it('only books the slot named by slotId', async () => {
		const other = await mkClient(therapistId, { name: 'Other' });
		const mine = await mkReservedSlot(dateAhead(2).weekday);
		await mkReservedSlot(dateAhead(3).weekday, { reservedClientId: other.id });

		await materialiseReservedSlots({ slotId: mine.id });

		expect((await appointmentsFor(clientId)).length).toBeGreaterThan(0);
		expect(await appointmentsFor(other.id)).toHaveLength(0);
	});
});

describe('materialiseReservedSlots: never books', () => {
	it('skips a weekday the therapist has marked as a holiday', async () => {
		const target = dateAhead(3);
		await mkReservedSlot(target.weekday);
		await saveWeekDay(therapistId, target.weekday, null, true);

		const result = await materialiseReservedSlots();

		expect(result.created).toBe(0);
		expect(await appointmentsFor(clientId)).toHaveLength(0);
	});

	it('skips a date turned into a day off, but still books the other weeks', async () => {
		const target = dateAhead(3);
		await mkReservedSlot(target.weekday);
		await setDateOverride(therapistId, target.key, { slots: [], maxSessions: null });

		await materialiseReservedSlots();

		const rows = await appointmentsFor(clientId);
		expect(rows.length).toBeGreaterThanOrEqual(1);
		for (const row of rows) {
			expect(row.startAt.getTime()).not.toBe(target.at(10).getTime());
		}
	});

	it('skips a date hand-edited to different times', async () => {
		const target = dateAhead(3);
		await mkReservedSlot(target.weekday);
		await setDateOverride(therapistId, target.key, {
			slots: [{ startTime: '16:00', endTime: '17:00', modality: 'online' }],
			maxSessions: null
		});

		await materialiseReservedSlots();

		const times: number[] = [];
		for (const row of await appointmentsFor(clientId)) {
			times.push(row.startAt.getTime());
		}
		expect(times).not.toContain(target.at(10).getTime());
		expect(times).not.toContain(target.at(16).getTime());
	});

	it('still books a hand-edited date that keeps the same slot', async () => {
		const target = dateAhead(3);
		await mkReservedSlot(target.weekday);
		await setDateOverride(therapistId, target.key, {
			slots: [
				{ startTime: '10:00', endTime: '11:00', modality: 'online' },
				{ startTime: '16:00', endTime: '17:00', modality: 'online' }
			],
			maxSessions: null
		});

		await materialiseReservedSlots();

		const times: number[] = [];
		for (const row of await appointmentsFor(clientId)) {
			times.push(row.startAt.getTime());
		}
		expect(times).toContain(target.at(10).getTime());
	});

	it('skips a deactivated client', async () => {
		await mkReservedSlot(dateAhead(2).weekday);
		await db.update(client).set({ deactivatedAt: new Date() }).where(eq(client.id, clientId));

		const result = await materialiseReservedSlots();

		expect(result).toEqual({ created: 0, blocked: 0, failed: 0 });
		expect(await appointmentsFor(clientId)).toHaveLength(0);
	});

	it('skips a hybrid slot', async () => {
		await mkReservedSlot(dateAhead(2).weekday, { modality: 'hybrid' });
		const result = await materialiseReservedSlots();
		expect(result).toEqual({ created: 0, blocked: 0, failed: 0 });
	});

	it('does not book a week that was cancelled, or one that was rescheduled', async () => {
		const target = dateAhead(3);
		await mkReservedSlot(target.weekday);
		await materialiseReservedSlots();
		const before = await appointmentsFor(clientId);
		expect(before.length).toBeGreaterThanOrEqual(2);

		await db.update(appointment).set({ status: 'cancelled' }).where(eq(appointment.id, before[0].id));
		await db.update(appointment).set({ status: 'rescheduled' }).where(eq(appointment.id, before[1].id));

		const result = await materialiseReservedSlots();

		expect(result.created).toBe(0);
		expect(await appointmentsFor(clientId)).toHaveLength(before.length);
	});

	it('counts a week that overlaps another booking as blocked, and charges nothing for it', async () => {
		const target = dateAhead(3);
		const otherClient = await mkClient(therapistId, { name: 'Busy' });
		await mkAppointment(therapistId, otherClient.id, { startAt: target.at(10), endAt: target.at(11) });
		await mkReservedSlot(target.weekday);

		const result = await materialiseReservedSlots();

		expect(result.blocked).toBe(1);
		expect(result.failed).toBe(0);
		const times: number[] = [];
		for (const row of await appointmentsFor(clientId)) {
			times.push(row.startAt.getTime());
		}
		expect(times).not.toContain(target.at(10).getTime());
		expect(result.created).toBe(times.length);
		const charges = await db.select().from(payment).where(eq(payment.clientId, clientId));
		expect(charges).toHaveLength(times.length);
	});

	it('does not book past dates or dates beyond the window', async () => {
		await mkReservedSlot(dateAhead(2).weekday);
		await materialiseReservedSlots();
		const now = Date.now();
		for (const row of await appointmentsFor(clientId)) {
			expect(row.startAt.getTime()).toBeGreaterThan(now - 1000);
			expect(row.startAt.getTime()).toBeLessThanOrEqual(now + 14 * DAY_MS + 1000);
		}
	});

	it('the cron itself never deletes or cancels', async () => {
		const target = dateAhead(3);
		const existing = await mkAppointment(therapistId, clientId, {
			startAt: target.at(15),
			endAt: target.at(16)
		});
		await mkReservedSlot(target.weekday);

		await materialiseReservedSlots();

		expect((await appointmentById(existing.id)).status).toBe('confirmed');
		const cancelled = await db
			.select()
			.from(appointment)
			.where(and(eq(appointment.clientId, clientId), eq(appointment.status, 'cancelled')));
		expect(cancelled).toHaveLength(0);
	});
});

describe('materialiseReservedSlots: charges and packs', () => {
	it("charges the client's rate for each booked week", async () => {
		await mkReservedSlot(dateAhead(2).weekday);
		await materialiseReservedSlots();

		const rows = await appointmentsFor(clientId);
		const charges = await db.select().from(payment).where(eq(payment.clientId, clientId));
		expect(charges).toHaveLength(rows.length);
		for (const charge of charges) {
			expect(charge.amount).toBe(1500);
		}
	});

	it('uses pack credits before charging, and charges once the pack is used up', async () => {
		const pack = await mkPack(therapistId, clientId, { sessionCount: 1, status: 'active' });
		await mkReservedSlot(dateAhead(2).weekday);

		await materialiseReservedSlots();

		const rows = await appointmentsFor(clientId);
		expect(rows.length).toBeGreaterThanOrEqual(2);
		// the earliest week takes the pack credit, the rest are ordinary charges
		expect(rows[0].packId).toBe(pack.id);
		for (const row of rows.slice(1)) {
			expect(row.packId).toBeNull();
		}
		const charges = await db.select().from(payment).where(eq(payment.clientId, clientId));
		expect(charges).toHaveLength(rows.length - 1);
		expect((await packById(pack.id)).status).toBe('completed');
	});
});

describe('materialiseReservedSlots: failures', () => {
	it('returns a zero result when there is nothing to do', async () => {
		expect(await materialiseReservedSlots()).toEqual({ created: 0, blocked: 0, failed: 0 });
	});
});

describe('materialiseReservedSlots: a hold the client rescheduled', () => {
	it('the new row has no slotId, survives a slot delete, and the old row stops a rebook', async () => {
		const target = dateAhead(3);
		const slot = await mkReservedSlot(target.weekday);
		await materialiseReservedSlots();
		const [firstWeek] = await appointmentsFor(clientId);

		const moved = await rescheduleAppointmentForTherapist(therapistId, firstWeek.id, {
			year: target.year,
			month: target.month,
			day: target.day,
			startHour: 15,
			startMinute: 0,
			endHour: 16,
			endMinute: 0,
			modality: 'online'
		});
		if (!('appointment' in moved)) {
			throw new Error(`reschedule failed: ${moved.error}`);
		}
		expect(moved.appointment.slotId).toBeNull();

		// the old 'rescheduled' row keeps its slotId and blocks the cron rebooking 10:00 that week
		const rerun = await materialiseReservedSlots();
		expect(rerun.created).toBe(0);

		await runDelete(slot.id);

		expect((await appointmentById(moved.appointment.id)).status).toBe('confirmed');
		expect((await appointmentById(firstWeek.id)).status).toBe('rescheduled');
	});
});

describe('deleteFutureHolds', () => {
	it('deletes only future confirmed appointments with this slotId', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const first = await mkHold(slot.id, 3);
		const second = await mkHold(slot.id, 10);

		await runDelete(slot.id);

		expect(await appointmentById(first.id)).toBeUndefined();
		expect(await appointmentById(second.id)).toBeUndefined();
	});

	it('leaves a portal or manual booking at the same time alone', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const manual = await mkAppointment(therapistId, clientId, {
			startAt: dateAhead(3).at(10),
			endAt: dateAhead(3).at(11)
		});

		await runDelete(slot.id);

		expect((await appointmentById(manual.id)).status).toBe('confirmed');
	});

	it("leaves another slot's holds alone, including the same client's other reserved slot", async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const otherSlot = await mkReservedSlot(dateAhead(4).weekday);
		const mine = await mkHold(slot.id, 3);
		const theirs = await mkHold(otherSlot.id, 4);

		await runDelete(slot.id);

		expect(await appointmentById(mine.id)).toBeUndefined();
		expect((await appointmentById(theirs.id)).status).toBe('confirmed');
	});

	it('leaves an in-progress session alone', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const inProgress = await mkAppointment(therapistId, clientId, {
			startAt: new Date(Date.now() - 30 * 60_000),
			endAt: new Date(Date.now() + 30 * 60_000),
			slotId: slot.id
		});

		await runDelete(slot.id);

		expect((await appointmentById(inProgress.id)).status).toBe('confirmed');
	});

	it('leaves past, completed and cancelled holds alone', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const past = await mkAppointment(therapistId, clientId, {
			startAt: new Date(Date.now() - 7 * DAY_MS),
			endAt: new Date(Date.now() - 7 * DAY_MS + 60 * 60_000),
			status: 'completed',
			slotId: slot.id
		});
		const cancelled = await mkHold(slot.id, 3, { status: 'cancelled' });

		await runDelete(slot.id);

		expect((await appointmentById(past.id)).status).toBe('completed');
		expect((await appointmentById(cancelled.id)).status).toBe('cancelled');
	});

	it("deletes the hold's unpaid payment row", async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const hold = await mkHold(slot.id, 3);
		const charge = await mkPayment(therapistId, clientId, { appointmentId: hold.id });

		await runDelete(slot.id);

		expect(await paymentById(charge.id)).toBeUndefined();
	});

	it('keeps a paid payment row, unlinked', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const hold = await mkHold(slot.id, 3);
		const charge = await mkPayment(therapistId, clientId, {
			appointmentId: hold.id,
			status: 'paid',
			paidAt: new Date()
		});

		await runDelete(slot.id);

		const after = await paymentById(charge.id);
		expect(after.status).toBe('paid');
		expect(after.appointmentId).toBeNull();
	});

	it('keeps an unpaid payment with a checkout in progress, unlinked', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const hold = await mkHold(slot.id, 3);
		const charge = await mkPayment(therapistId, clientId, {
			appointmentId: hold.id,
			razorpayOrderId: 'order_in_progress',
			razorpayOrderCreatedAt: new Date()
		});

		await runDelete(slot.id);

		const after = await paymentById(charge.id);
		expect(after.status).toBe('unpaid');
		expect(after.razorpayOrderId).toBe('order_in_progress');
		expect(after.appointmentId).toBeNull();
	});

	it('leaves the fee payment of a hold the client cancelled', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const cancelled = await mkHold(slot.id, 3, { status: 'cancelled' });
		const fee = await mkPayment(therapistId, clientId, { appointmentId: cancelled.id, amount: 750 });

		await runDelete(slot.id);

		expect((await paymentById(fee.id)).appointmentId).toBe(cancelled.id);
	});

	it("a hold on an active pack: the pack's remaining goes up by one", async () => {
		const pack = await mkPack(therapistId, clientId, { sessionCount: 5, status: 'active' });
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		await mkHold(slot.id, 3, { packId: pack.id });
		expect((await getActivePackForClient(clientId))!.remaining).toBe(4);

		await runDelete(slot.id);

		const after = await getActivePackForClient(clientId);
		expect(after!.id).toBe(pack.id);
		expect(after!.remaining).toBe(5);
	});

	it('a hold on a completed pack: the pack reopens as active with one credit', async () => {
		const pack = await mkPack(therapistId, clientId, { sessionCount: 1, status: 'completed' });
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		await mkHold(slot.id, 3, { packId: pack.id });

		await runDelete(slot.id);

		const after = await getActivePackForClient(clientId);
		expect(after!.id).toBe(pack.id);
		expect(after!.remaining).toBe(1);
	});

	it('a hold on a completed pack when the client has a newer active pack: the credit moves onto the newer pack', async () => {
		const old = await mkPack(therapistId, clientId, { sessionCount: 1, status: 'completed' });
		const newer = await mkPack(therapistId, clientId, { sessionCount: 5, status: 'active' });
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		await mkHold(slot.id, 3, { packId: old.id });

		await runDelete(slot.id);

		expect((await packById(old.id)).status).toBe('completed');
		const after = await getActivePackForClient(clientId);
		expect(after!.id).toBe(newer.id);
		expect(after!.remaining).toBe(6);
	});

	it('two holds on the same completed pack: both credits come back', async () => {
		const pack = await mkPack(therapistId, clientId, { sessionCount: 2, status: 'completed' });
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		await mkHold(slot.id, 3, { packId: pack.id });
		await mkHold(slot.id, 10, { packId: pack.id });

		await runDelete(slot.id);

		const after = await getActivePackForClient(clientId);
		expect(after!.id).toBe(pack.id);
		expect(after!.remaining).toBe(2);
	});

	it('a client note attached to a hold survives, unlinked', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const hold = await mkHold(slot.id, 3);
		const note = await mkNote(therapistId, clientId, { appointmentId: hold.id });

		await runDelete(slot.id);

		const [after] = await db.select().from(clientNote).where(eq(clientNote.id, note.id));
		expect(after.body).toBe('note body');
		expect(after.appointmentId).toBeNull();
	});

	it('returns the deleted rows, so the caller can remove their Meet events', async () => {
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const first = await mkHold(slot.id, 3, { meetLink: 'https://meet.example/a' });
		const second = await mkHold(slot.id, 10);
		await mkHold(slot.id, 4, { status: 'cancelled' });

		const deleted = await runDelete(slot.id);

		const ids: string[] = [];
		for (const row of deleted) {
			ids.push(row.id);
		}
		ids.sort();
		const expected = [first.id, second.id];
		expected.sort();
		expect(ids).toEqual(expected);
		let withLink = null;
		for (const row of deleted) {
			if (row.id === first.id) {
				withLink = row;
			}
		}
		expect(withLink!.meetLink).toBe('https://meet.example/a');
	});

	it("rolls back fully when the caller's transaction throws", async () => {
		const pack = await mkPack(therapistId, clientId, { sessionCount: 1, status: 'completed' });
		const slot = await mkReservedSlot(dateAhead(3).weekday);
		const hold = await mkHold(slot.id, 3, { packId: pack.id });
		const charge = await mkPayment(therapistId, clientId, { appointmentId: hold.id });

		await expect(
			db.transaction(async (tx) => {
				await deleteFutureHolds(tx, slot.id);
				throw new Error('boom');
			})
		).rejects.toThrow('boom');

		expect((await appointmentById(hold.id)).status).toBe('confirmed');
		expect((await paymentById(charge.id)).appointmentId).toBe(hold.id);
		expect((await packById(pack.id)).status).toBe('completed');
	});
});

describe('setDateOverride', () => {
	it('ignores a supplied id rather than using it as the primary key', async () => {
		const target = dateAhead(3);
		const fake = '22222222-2222-2222-2222-222222222222';
		await setDateOverride(therapistId, target.key, {
			slots: [{ id: fake, startTime: '10:00', endTime: '11:00', modality: 'online' }],
			maxSessions: null
		});
		const rows = await db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, therapistId));
		expect(rows).toHaveLength(1);
		expect(rows[0].id).not.toBe(fake);
		expect(rows[0].reservedClientId).toBeNull();
	});
});
