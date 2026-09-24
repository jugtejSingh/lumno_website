import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment, availabilitySlot, payment, paymentPack, client } from '$lib/server/db/schema';
import { materialiseReservedSlots } from '$lib/server/recurringBookings';
import { replaceWeekTemplate, setDateOverride, setSlotReservation, getSlotDesign } from '$lib/server/availabilitySlots';
import type { DesignedSlot, WeeklyDay } from '$lib/types/slots';
import { resetDb, mkTherapist, mkClient, mkPack, mkAppointment } from './helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

let therapistId: string;
let clientId: string;

// The therapist is on UTC, so a slot at 10:00 is 10:00 UTC. `daysAhead` from 1 to 13 is always
// inside the 14 day window and always in the future, whatever time of day the suite runs.
function dateAhead(daysAhead: number) {
	const date = new Date(Date.now() + daysAhead * DAY_MS);
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	const day = date.getUTCDate();
	const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	return {
		year,
		month,
		day,
		weekday: date.getUTCDay(),
		key,
		at(hour: number) {
			return new Date(Date.UTC(year, month, day, hour, 0));
		}
	};
}

async function mkReservedSlot(
	weekday: number,
	overrides: Partial<typeof availabilitySlot.$inferInsert> = {}
) {
	const [row] = await db
		.insert(availabilitySlot)
		.values({
			therapistId,
			weekday,
			startTime: '10:00',
			endTime: '11:00',
			modality: 'online',
			reservedClientId: clientId,
			...overrides
		})
		.returning();
	return row;
}

async function appointmentsFor(forClientId: string) {
	return db.select().from(appointment).where(eq(appointment.clientId, forClientId)).orderBy(appointment.startAt);
}

function emptyWeek(): WeeklyDay[] {
	const week: WeeklyDay[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		week.push({ slots: [], maxSessions: null, holiday: false });
	}
	return week;
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

	it('is idempotent: a second and third run create nothing', async () => {
		await mkReservedSlot(dateAhead(2).weekday);
		const first = await materialiseReservedSlots();
		const second = await materialiseReservedSlots();
		const third = await materialiseReservedSlots();

		expect(first.created).toBeGreaterThan(0);
		expect(second).toEqual({ created: 0, failed: 0 });
		expect(third).toEqual({ created: 0, failed: 0 });
		expect((await appointmentsFor(clientId)).length).toBe(first.created);
	});

	it('books nothing when no slot is reserved', async () => {
		await mkReservedSlot(dateAhead(2).weekday, { reservedClientId: null });
		const result = await materialiseReservedSlots();
		expect(result).toEqual({ created: 0, failed: 0 });
		expect(await appointmentsFor(clientId)).toHaveLength(0);
	});

	it('honours the therapist timezone', async () => {
		const kolkata = await mkTherapist({ timezone: 'Asia/Kolkata' });
		const kolkataClient = await mkClient(kolkata.id);
		// 10:00 IST is 04:30 UTC. Book it on tomorrow's IST calendar date.
		const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
		const tomorrow = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + 1));
		await db.insert(availabilitySlot).values({
			therapistId: kolkata.id,
			weekday: tomorrow.getUTCDay(),
			startTime: '10:00',
			endTime: '11:00',
			modality: 'online',
			reservedClientId: kolkataClient.id
		});

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
		await db.insert(availabilitySlot).values({
			therapistId: otherTherapist.id,
			weekday: dateAhead(2).weekday,
			startTime: '10:00',
			endTime: '11:00',
			modality: 'online',
			reservedClientId: thirdClient.id
		});

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
		const slot = await mkReservedSlot(target.weekday);
		const week = emptyWeek();
		week[target.weekday] = {
			slots: [{ id: slot.id, startTime: '10:00', endTime: '11:00', modality: 'online' }],
			maxSessions: null,
			holiday: true
		};
		await replaceWeekTemplate(therapistId, week);

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

		const times = (await appointmentsFor(clientId)).map((row) => row.startAt.getTime());
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

		const times = (await appointmentsFor(clientId)).map((row) => row.startAt.getTime());
		expect(times).toContain(target.at(10).getTime());
	});

	it('skips a deactivated client', async () => {
		await mkReservedSlot(dateAhead(2).weekday);
		await db.update(client).set({ deactivatedAt: new Date() }).where(eq(client.id, clientId));

		const result = await materialiseReservedSlots();

		expect(result).toEqual({ created: 0, failed: 0 });
		expect(await appointmentsFor(clientId)).toHaveLength(0);
	});

	it('skips a hybrid slot', async () => {
		await mkReservedSlot(dateAhead(2).weekday, { modality: 'hybrid' });
		const result = await materialiseReservedSlots();
		expect(result).toEqual({ created: 0, failed: 0 });
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

	it('does not book a time that overlaps another booking, and charges nothing for it', async () => {
		const target = dateAhead(3);
		const otherClient = await mkClient(therapistId, { name: 'Busy' });
		await mkAppointment(therapistId, otherClient.id, { startAt: target.at(10), endAt: target.at(11) });
		await mkReservedSlot(target.weekday);

		const result = await materialiseReservedSlots();

		expect(result.failed).toBe(0);
		const times = (await appointmentsFor(clientId)).map((row) => row.startAt.getTime());
		expect(times).not.toContain(target.at(10).getTime());
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

	it('cancels nothing and leaves existing appointments untouched', async () => {
		const target = dateAhead(3);
		const existing = await mkAppointment(therapistId, clientId, {
			startAt: target.at(15),
			endAt: target.at(16)
		});
		await mkReservedSlot(target.weekday);

		await materialiseReservedSlots();

		const [after] = await db.select().from(appointment).where(eq(appointment.id, existing.id));
		expect(after.status).toBe('confirmed');
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
		const [updatedPack] = await db.select().from(paymentPack).where(eq(paymentPack.id, pack.id));
		expect(updatedPack.status).toBe('completed');
	});
});

describe('materialiseReservedSlots: failures', () => {
	it('returns a zero result when there is nothing to do', async () => {
		expect(await materialiseReservedSlots()).toEqual({ created: 0, failed: 0 });
	});
});

describe('setSlotReservation', () => {
	it('reserves and then releases a weekly slot', async () => {
		const slot = await mkReservedSlot(2, { reservedClientId: null });

		expect(await setSlotReservation(therapistId, slot.id, clientId)).toEqual({});
		let [row] = await db.select().from(availabilitySlot).where(eq(availabilitySlot.id, slot.id));
		expect(row.reservedClientId).toBe(clientId);

		expect(await setSlotReservation(therapistId, slot.id, null)).toEqual({});
		[row] = await db.select().from(availabilitySlot).where(eq(availabilitySlot.id, slot.id));
		expect(row.reservedClientId).toBeNull();
	});

	it('rejects an unknown slot', async () => {
		const result = await setSlotReservation(therapistId, '00000000-0000-0000-0000-000000000000', clientId);
		expect(result.error).toBe('slot_not_found');
	});

	it("rejects another therapist's slot", async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const slot = await mkReservedSlot(2, { reservedClientId: null });
		const result = await setSlotReservation(other.id, slot.id, null);
		expect(result.error).toBe('slot_not_found');
	});

	it("rejects another therapist's client", async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const strangerClient = await mkClient(other.id);
		const slot = await mkReservedSlot(2, { reservedClientId: null });
		const result = await setSlotReservation(therapistId, slot.id, strangerClient.id);
		expect(result.error).toBe('client_not_found');
		const [row] = await db.select().from(availabilitySlot).where(eq(availabilitySlot.id, slot.id));
		expect(row.reservedClientId).toBeNull();
	});

	it('rejects a hybrid slot', async () => {
		const slot = await mkReservedSlot(2, { modality: 'hybrid', reservedClientId: null });
		const result = await setSlotReservation(therapistId, slot.id, clientId);
		expect(result.error).toBe('hybrid_slot');
	});

	it('rejects a date-override slot', async () => {
		const target = dateAhead(3);
		await setDateOverride(therapistId, target.key, {
			slots: [{ startTime: '10:00', endTime: '11:00', modality: 'online' }],
			maxSessions: null
		});
		const rows = await db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, therapistId));
		const result = await setSlotReservation(therapistId, rows[0].id, clientId);
		expect(result.error).toBe('slot_not_found');
	});
});

describe('replaceWeekTemplate keeps saved slots in place', () => {
	function slot(startTime: string, endTime: string, id?: string): DesignedSlot {
		return { id, startTime, endTime, modality: 'online' };
	}

	it('adding a Friday slot keeps the reserved Tuesday row, id and reservation', async () => {
		const tuesday = await mkReservedSlot(2);
		const week = emptyWeek();
		week[2].slots = [slot('10:00', '11:00', tuesday.id)];
		week[5].slots = [slot('09:00', '10:00')];

		await replaceWeekTemplate(therapistId, week);

		const rows = await db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, therapistId));
		expect(rows).toHaveLength(2);
		const kept = rows.find((row) => row.id === tuesday.id);
		expect(kept).toBeDefined();
		expect(kept!.reservedClientId).toBe(clientId);
		expect(rows.find((row) => row.weekday === 5)).toBeDefined();
	});

	it('an untouched save changes nothing', async () => {
		const tuesday = await mkReservedSlot(2);
		const week = emptyWeek();
		week[2].slots = [slot('10:00', '11:00', tuesday.id)];

		await replaceWeekTemplate(therapistId, week);
		await replaceWeekTemplate(therapistId, week);

		const rows = await db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, therapistId));
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe(tuesday.id);
		expect(rows[0].reservedClientId).toBe(clientId);
	});

	it('editing a time updates the row and keeps its reservation', async () => {
		const tuesday = await mkReservedSlot(2);
		const week = emptyWeek();
		week[2].slots = [slot('17:00', '18:00', tuesday.id)];

		await replaceWeekTemplate(therapistId, week);

		const [row] = await db.select().from(availabilitySlot).where(eq(availabilitySlot.id, tuesday.id));
		expect(row.startTime.slice(0, 5)).toBe('17:00');
		expect(row.endTime.slice(0, 5)).toBe('18:00');
		expect(row.reservedClientId).toBe(clientId);
	});

	it('deletes slots that were removed', async () => {
		const tuesday = await mkReservedSlot(2);
		await replaceWeekTemplate(therapistId, emptyWeek());
		const rows = await db.select().from(availabilitySlot).where(eq(availabilitySlot.id, tuesday.id));
		expect(rows).toHaveLength(0);
	});

	it('treats an unknown id as a new slot', async () => {
		const week = emptyWeek();
		week[1].slots = [slot('09:00', '10:00', '11111111-1111-1111-1111-111111111111')];
		await replaceWeekTemplate(therapistId, week);
		const rows = await db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, therapistId));
		expect(rows).toHaveLength(1);
		expect(rows[0].id).not.toBe('11111111-1111-1111-1111-111111111111');
	});

	it('a duplicated id (a copied day) keeps the original and inserts the copy as new', async () => {
		const tuesday = await mkReservedSlot(2);
		const week = emptyWeek();
		week[2].slots = [slot('10:00', '11:00', tuesday.id)];
		week[3].slots = [slot('10:00', '11:00', tuesday.id)];

		await replaceWeekTemplate(therapistId, week);

		const rows = await db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, therapistId));
		expect(rows).toHaveLength(2);
		const original = rows.find((row) => row.id === tuesday.id);
		expect(original!.weekday).toBe(2);
		expect(original!.reservedClientId).toBe(clientId);
		const copy = rows.find((row) => row.id !== tuesday.id);
		expect(copy!.weekday).toBe(3);
		expect(copy!.reservedClientId).toBeNull();
	});

	it("never touches another therapist's slot, even when its id is sent", async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const otherClient = await mkClient(other.id);
		const [theirs] = await db
			.insert(availabilitySlot)
			.values({
				therapistId: other.id,
				weekday: 4,
				startTime: '08:00',
				endTime: '09:00',
				modality: 'online',
				reservedClientId: otherClient.id
			})
			.returning();
		const week = emptyWeek();
		week[1].slots = [slot('12:00', '13:00', theirs.id)];

		await replaceWeekTemplate(therapistId, week);

		const [untouched] = await db.select().from(availabilitySlot).where(eq(availabilitySlot.id, theirs.id));
		expect(untouched.therapistId).toBe(other.id);
		expect(untouched.weekday).toBe(4);
		expect(untouched.startTime.slice(0, 5)).toBe('08:00');
		expect(untouched.reservedClientId).toBe(otherClient.id);
		const mine = await db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, therapistId));
		expect(mine).toHaveLength(1);
		expect(mine[0].weekday).toBe(1);
	});

	it('a reservation sent from the browser is ignored', async () => {
		const week = emptyWeek();
		week[1].slots = [{ startTime: '09:00', endTime: '10:00', modality: 'online', reservedClientId: clientId }];
		await replaceWeekTemplate(therapistId, week);
		const rows = await db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, therapistId));
		expect(rows[0].reservedClientId).toBeNull();
	});

	it('getSlotDesign reports the id and reservation of weekly slots', async () => {
		const tuesday = await mkReservedSlot(2);
		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[2].slots[0].id).toBe(tuesday.id);
		expect(design.week[2].slots[0].reservedClientId).toBe(clientId);
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
