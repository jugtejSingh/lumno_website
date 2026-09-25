import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment, availabilitySlot, therapistSettings } from '$lib/server/db/schema';
import { addSlot, updateSlot, deleteSlot, reserveSlot, saveWeekDay, copyDay } from '$lib/server/weeklySlots';
import { getSlotDesign } from '$lib/server/availabilitySlots';
import { listAvailabilityForMonth } from '$lib/server/availability';
import { resetDb, mkTherapist, mkClient, mkSlot, mkAppointment, dateAhead } from './helpers';

// The weekly slot operations (docs/weekly slots.md). Every operation works on one slot by id.
// Reserved-slot changes delete that slot's future holds; open-slot changes never touch bookings.

const DAY_MS = 24 * 60 * 60 * 1000;

let therapistId: string;
let clientA: string;
let clientB: string;

// day 3's weekday occurs exactly twice in the 14 day window: day 3 and day 10
const target = dateAhead(3);
const nextWeek = dateAhead(10);

async function slotRow(id: string) {
	const [row] = await db.select().from(availabilitySlot).where(eq(availabilitySlot.id, id));
	return row;
}

async function slotRows(forTherapistId: string) {
	return db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, forTherapistId));
}

async function confirmedFor(forClientId: string) {
	return db
		.select()
		.from(appointment)
		.where(and(eq(appointment.clientId, forClientId), eq(appointment.status, 'confirmed')))
		.orderBy(appointment.startAt);
}

function startTimes(rows: { startAt: Date }[]) {
	const times: number[] = [];
	for (const row of rows) {
		times.push(row.startAt.getTime());
	}
	return times;
}

// an open 10:00–11:00 online slot on the target weekday, then reserved for `clientId` (books its holds)
async function mkReserved(clientId: string, overrides: Partial<typeof availabilitySlot.$inferInsert> = {}) {
	const slot = await mkSlot(therapistId, { weekday: target.weekday, ...overrides });
	const result = await reserveSlot(therapistId, slot.id, clientId);
	expect(result.error).toBeUndefined();
	return slot;
}

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ timezone: 'UTC' })).id;
	clientA = (await mkClient(therapistId, { name: 'A' })).id;
	clientB = (await mkClient(therapistId, { name: 'B' })).id;
});

describe('addSlot', () => {
	it('adds an open weekly slot and returns its id', async () => {
		const result = await addSlot(therapistId, { weekday: 2, startTime: '09:00', endTime: '10:00', modality: 'online' });

		expect(result.error).toBeUndefined();
		const row = await slotRow(result.id!);
		expect(row.therapistId).toBe(therapistId);
		expect(row.weekday).toBe(2);
		expect(row.startTime.slice(0, 5)).toBe('09:00');
		expect(row.endTime.slice(0, 5)).toBe('10:00');
		expect(row.modality).toBe('online');
		expect(row.reservedClientId).toBeNull();
	});

	it('allows a slot that overlaps an open slot on the same day', async () => {
		await mkSlot(therapistId, { weekday: 2, startTime: '09:00', endTime: '10:00' });

		const result = await addSlot(therapistId, { weekday: 2, startTime: '09:30', endTime: '10:30', modality: 'online' });

		expect(result.error).toBeUndefined();
		expect(await slotRows(therapistId)).toHaveLength(2);
	});

	it('rejects a slot that overlaps a reserved slot on the same day', async () => {
		await mkSlot(therapistId, { weekday: 2, startTime: '09:00', endTime: '10:00', reservedClientId: clientA });

		const result = await addSlot(therapistId, { weekday: 2, startTime: '09:30', endTime: '10:30', modality: 'online' });

		expect(result.error).toBe('reserved_overlap');
		expect(await slotRows(therapistId)).toHaveLength(1);
	});

	it('allows a slot touching a reserved slot at the edge', async () => {
		await mkSlot(therapistId, { weekday: 2, startTime: '09:00', endTime: '10:00', reservedClientId: clientA });

		const result = await addSlot(therapistId, { weekday: 2, startTime: '10:00', endTime: '11:00', modality: 'online' });

		expect(result.error).toBeUndefined();
	});
});

describe('updateSlot: open slot', () => {
	it('updates the row and leaves booked appointments in the old time untouched', async () => {
		const slot = await mkSlot(therapistId, { weekday: target.weekday });
		const booked = await mkAppointment(therapistId, clientA, { startAt: target.at(10), endAt: target.at(11) });

		const result = await updateSlot(therapistId, slot.id, {
			weekday: target.weekday,
			startTime: '14:00',
			endTime: '15:00',
			modality: 'in_person'
		});

		expect(result.error).toBeUndefined();
		const row = await slotRow(slot.id);
		expect(row.startTime.slice(0, 5)).toBe('14:00');
		expect(row.modality).toBe('in_person');
		const [after] = await db.select().from(appointment).where(eq(appointment.id, booked.id));
		expect(after.status).toBe('confirmed');
	});

	it('can be changed to hybrid', async () => {
		const slot = await mkSlot(therapistId, { weekday: 2 });
		const result = await updateSlot(therapistId, slot.id, {
			weekday: 2,
			startTime: '10:00',
			endTime: '11:00',
			modality: 'hybrid'
		});
		expect(result.error).toBeUndefined();
		expect((await slotRow(slot.id)).modality).toBe('hybrid');
	});

	it('rejects a change that would overlap a reserved slot on that day', async () => {
		await mkSlot(therapistId, { weekday: 2, startTime: '09:00', endTime: '10:00', reservedClientId: clientA });
		const open = await mkSlot(therapistId, { weekday: 2, startTime: '12:00', endTime: '13:00' });

		const result = await updateSlot(therapistId, open.id, {
			weekday: 2,
			startTime: '09:30',
			endTime: '10:30',
			modality: 'online'
		});

		expect(result.error).toBe('reserved_overlap');
		expect((await slotRow(open.id)).startTime.slice(0, 5)).toBe('12:00');
	});
});

describe('updateSlot: reserved slot', () => {
	it('a new time deletes the old holds, keeps the reservation, and books the new time', async () => {
		const slot = await mkReserved(clientA);
		expect(startTimes(await confirmedFor(clientA))).toEqual([target.at(10).getTime(), nextWeek.at(10).getTime()]);

		const result = await updateSlot(therapistId, slot.id, {
			weekday: target.weekday,
			startTime: '15:00',
			endTime: '16:00',
			modality: 'online'
		});

		expect(result.error).toBeUndefined();
		expect(result.booking).toEqual({ created: 2, blocked: 0, failed: 0 });
		expect((await slotRow(slot.id)).reservedClientId).toBe(clientA);
		const holds = await confirmedFor(clientA);
		expect(startTimes(holds)).toEqual([target.at(15).getTime(), nextWeek.at(15).getTime()]);
		for (const hold of holds) {
			expect(hold.slotId).toBe(slot.id);
		}
	});

	it('9:00–10:00 → 9:30–10:30 books the new time every week, nothing blocked by the old holds', async () => {
		const slot = await mkReserved(clientA, { startTime: '09:00', endTime: '10:00' });

		const result = await updateSlot(therapistId, slot.id, {
			weekday: target.weekday,
			startTime: '09:30',
			endTime: '10:30',
			modality: 'online'
		});

		expect(result.booking).toEqual({ created: 2, blocked: 0, failed: 0 });
		expect(startTimes(await confirmedFor(clientA))).toEqual([
			target.at(9, 30).getTime(),
			nextWeek.at(9, 30).getTime()
		]);
	});

	it('a new weekday deletes the old day’s holds and books the new day', async () => {
		const slot = await mkReserved(clientA);
		const otherDay = dateAhead(4);

		await updateSlot(therapistId, slot.id, {
			weekday: otherDay.weekday,
			startTime: '10:00',
			endTime: '11:00',
			modality: 'online'
		});

		const holds = await confirmedFor(clientA);
		expect(holds).toHaveLength(2);
		for (const hold of holds) {
			expect(hold.startAt.getUTCDay()).toBe(otherDay.weekday);
		}
	});

	it('a new modality deletes the old holds and books the new modality', async () => {
		const slot = await mkReserved(clientA);

		await updateSlot(therapistId, slot.id, {
			weekday: target.weekday,
			startTime: '10:00',
			endTime: '11:00',
			modality: 'in_person'
		});

		const holds = await confirmedFor(clientA);
		expect(holds).toHaveLength(2);
		for (const hold of holds) {
			expect(hold.modality).toBe('in_person');
		}
	});

	it('changing to hybrid is rejected, and nothing is deleted or changed', async () => {
		const slot = await mkReserved(clientA);
		const before = await confirmedFor(clientA);

		const result = await updateSlot(therapistId, slot.id, {
			weekday: target.weekday,
			startTime: '10:00',
			endTime: '11:00',
			modality: 'hybrid'
		});

		expect(result.error).toBe('hybrid_slot');
		expect((await slotRow(slot.id)).modality).toBe('online');
		expect(await confirmedFor(clientA)).toEqual(before);
	});

	it('saving with no actual change deletes nothing', async () => {
		const slot = await mkReserved(clientA);
		const before = await confirmedFor(clientA);

		const result = await updateSlot(therapistId, slot.id, {
			weekday: target.weekday,
			startTime: '10:00',
			endTime: '11:00',
			modality: 'online'
		});

		expect(result.error).toBeUndefined();
		expect(await confirmedFor(clientA)).toEqual(before);
	});

	it('a change that would overlap another slot on that day is rejected', async () => {
		const slot = await mkReserved(clientA);
		await mkSlot(therapistId, { weekday: target.weekday, startTime: '14:00', endTime: '15:00' });
		const before = await confirmedFor(clientA);

		const result = await updateSlot(therapistId, slot.id, {
			weekday: target.weekday,
			startTime: '14:30',
			endTime: '15:30',
			modality: 'online'
		});

		expect(result.error).toBe('reserved_overlap');
		expect((await slotRow(slot.id)).startTime.slice(0, 5)).toBe('10:00');
		expect(await confirmedFor(clientA)).toEqual(before);
	});

	it('leaves a portal or manual booking at the old time alone', async () => {
		const slot = await mkSlot(therapistId, { weekday: target.weekday });
		// booked before the reservation, so it has no slotId
		const manual = await mkAppointment(therapistId, clientA, { startAt: target.at(10), endAt: target.at(11) });
		await reserveSlot(therapistId, slot.id, clientA);

		await updateSlot(therapistId, slot.id, {
			weekday: target.weekday,
			startTime: '15:00',
			endTime: '16:00',
			modality: 'online'
		});

		const [after] = await db.select().from(appointment).where(eq(appointment.id, manual.id));
		expect(after.status).toBe('confirmed');
	});
});

describe('updateSlot and deleteSlot: not found', () => {
	const input = { weekday: 2, startTime: '10:00', endTime: '11:00', modality: 'online' as const };

	it('another therapist’s slot is not found and nothing changes', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const theirs = await mkSlot(other.id, { weekday: 4, startTime: '08:00', endTime: '09:00' });

		expect((await updateSlot(therapistId, theirs.id, input)).error).toBe('slot_not_found');
		expect((await deleteSlot(therapistId, theirs.id)).error).toBe('slot_not_found');

		const row = await slotRow(theirs.id);
		expect(row.weekday).toBe(4);
		expect(row.startTime.slice(0, 5)).toBe('08:00');
	});

	it('an unknown id is not found', async () => {
		const unknown = '00000000-0000-0000-0000-000000000000';
		expect((await updateSlot(therapistId, unknown, input)).error).toBe('slot_not_found');
		expect((await deleteSlot(therapistId, unknown)).error).toBe('slot_not_found');
	});

	it('a date-override slot is not found', async () => {
		await db.execute(
			sql`insert into availability_date_override (therapist_id, date) values (${therapistId}, ${target.key})`
		);
		const dateSlot = await mkSlot(therapistId, { weekday: null, overrideDate: target.key });

		expect((await updateSlot(therapistId, dateSlot.id, input)).error).toBe('slot_not_found');
		expect((await deleteSlot(therapistId, dateSlot.id)).error).toBe('slot_not_found');
		expect(await slotRow(dateSlot.id)).toBeDefined();
	});
});

describe('deleteSlot', () => {
	it('an open slot: deletes the row, and its booked appointments stay confirmed', async () => {
		const slot = await mkSlot(therapistId, { weekday: target.weekday });
		const booked = await mkAppointment(therapistId, clientA, { startAt: target.at(10), endAt: target.at(11) });

		const result = await deleteSlot(therapistId, slot.id);

		expect(result.error).toBeUndefined();
		expect(await slotRow(slot.id)).toBeUndefined();
		const [after] = await db.select().from(appointment).where(eq(appointment.id, booked.id));
		expect(after.status).toBe('confirmed');
	});

	it('a reserved slot: deletes the row and all its future confirmed holds', async () => {
		const slot = await mkReserved(clientA);
		expect(await confirmedFor(clientA)).toHaveLength(2);

		await deleteSlot(therapistId, slot.id);

		expect(await slotRow(slot.id)).toBeUndefined();
		expect(await confirmedFor(clientA)).toHaveLength(0);
	});

	it('a reserved slot: past and completed holds stay, unlinked', async () => {
		const slot = await mkReserved(clientA);
		const past = await mkAppointment(therapistId, clientA, {
			startAt: new Date(Date.now() - 7 * DAY_MS),
			endAt: new Date(Date.now() - 7 * DAY_MS + 60 * 60_000),
			status: 'completed',
			slotId: slot.id
		});

		await deleteSlot(therapistId, slot.id);

		const [after] = await db.select().from(appointment).where(eq(appointment.id, past.id));
		expect(after.status).toBe('completed');
		expect(after.slotId).toBeNull();
	});

	it('a reserved slot: a hold the client cancelled themselves stays, unlinked', async () => {
		const slot = await mkReserved(clientA);
		const holds = await confirmedFor(clientA);
		await db.update(appointment).set({ status: 'cancelled' }).where(eq(appointment.id, holds[0].id));

		await deleteSlot(therapistId, slot.id);

		const [after] = await db.select().from(appointment).where(eq(appointment.id, holds[0].id));
		expect(after.status).toBe('cancelled');
		expect(after.slotId).toBeNull();
		expect(await confirmedFor(clientA)).toHaveLength(0);
	});
});

describe('reserveSlot', () => {
	it('books the coming weeks with slotId set, and reports what it booked', async () => {
		const slot = await mkSlot(therapistId, { weekday: target.weekday });

		const result = await reserveSlot(therapistId, slot.id, clientA);

		expect(result).toEqual({ booking: { created: 2, blocked: 0, failed: 0 } });
		expect((await slotRow(slot.id)).reservedClientId).toBe(clientA);
		for (const hold of await confirmedFor(clientA)) {
			expect(hold.slotId).toBe(slot.id);
		}
	});

	it('reports a week blocked by an existing booking', async () => {
		const slot = await mkSlot(therapistId, { weekday: target.weekday });
		await mkAppointment(therapistId, clientB, { startAt: target.at(10), endAt: target.at(11) });

		const result = await reserveSlot(therapistId, slot.id, clientA);

		expect(result.booking).toEqual({ created: 1, blocked: 1, failed: 0 });
	});

	it('A → B deletes A’s future holds and books B', async () => {
		const slot = await mkReserved(clientA);

		const result = await reserveSlot(therapistId, slot.id, clientB);

		expect(result.booking).toEqual({ created: 2, blocked: 0, failed: 0 });
		expect(await confirmedFor(clientA)).toHaveLength(0);
		expect(startTimes(await confirmedFor(clientB))).toEqual([target.at(10).getTime(), nextWeek.at(10).getTime()]);
	});

	it('A → B → A books A again, with no duplicates', async () => {
		const slot = await mkReserved(clientA);
		await reserveSlot(therapistId, slot.id, clientB);

		const result = await reserveSlot(therapistId, slot.id, clientA);

		expect(result.booking).toEqual({ created: 2, blocked: 0, failed: 0 });
		expect(await confirmedFor(clientB)).toHaveLength(0);
		expect(startTimes(await confirmedFor(clientA))).toEqual([target.at(10).getTime(), nextWeek.at(10).getTime()]);
		const everyRowForA = await db.select().from(appointment).where(eq(appointment.clientId, clientA));
		expect(everyRowForA).toHaveLength(2);
	});

	it('A → open deletes A’s future holds and books nothing', async () => {
		const slot = await mkReserved(clientA);

		const result = await reserveSlot(therapistId, slot.id, null);

		expect(result.error).toBeUndefined();
		expect(result.booking).toBeUndefined();
		expect((await slotRow(slot.id)).reservedClientId).toBeNull();
		expect(await confirmedFor(clientA)).toHaveLength(0);
	});

	it('A → open: the slot is offered to clients again', async () => {
		const slot = await mkReserved(clientA);
		await reserveSlot(therapistId, slot.id, null);

		const byDay = await listAvailabilityForMonth(therapistId, target.year, target.month);
		const offered: string[] = [];
		for (const available of byDay[target.day] ?? []) {
			offered.push(available.startTime);
		}
		expect(offered).toContain('10:00');
	});

	it('reserving the same client again deletes nothing', async () => {
		const slot = await mkReserved(clientA);
		const before = await confirmedFor(clientA);

		const result = await reserveSlot(therapistId, slot.id, clientA);

		expect(result.error).toBeUndefined();
		expect(await confirmedFor(clientA)).toEqual(before);
	});

	it('a week A cancelled stays cancelled after A → B → A, and B could book it meanwhile', async () => {
		const slot = await mkReserved(clientA);
		const [firstWeek] = await confirmedFor(clientA);
		await db.update(appointment).set({ status: 'cancelled' }).where(eq(appointment.id, firstWeek.id));

		await reserveSlot(therapistId, slot.id, clientB);
		expect(await confirmedFor(clientB)).toHaveLength(2);

		await reserveSlot(therapistId, slot.id, clientA);
		expect(startTimes(await confirmedFor(clientA))).toEqual([nextWeek.at(10).getTime()]);
		const [cancelled] = await db.select().from(appointment).where(eq(appointment.id, firstWeek.id));
		expect(cancelled.status).toBe('cancelled');
	});

	it('rejects a slot that overlaps another slot on the same day', async () => {
		const slot = await mkSlot(therapistId, { weekday: target.weekday, startTime: '10:00', endTime: '11:00' });
		await mkSlot(therapistId, { weekday: target.weekday, startTime: '10:30', endTime: '11:30' });

		const result = await reserveSlot(therapistId, slot.id, clientA);

		expect(result.error).toBe('reserved_overlap');
		expect((await slotRow(slot.id)).reservedClientId).toBeNull();
		expect(await confirmedFor(clientA)).toHaveLength(0);
	});

	it('rejects a hybrid slot', async () => {
		const slot = await mkSlot(therapistId, { weekday: 2, modality: 'hybrid' });
		expect((await reserveSlot(therapistId, slot.id, clientA)).error).toBe('hybrid_slot');
	});

	it('rejects an unknown slot, another therapist’s slot, and a date-override slot', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const theirs = await mkSlot(other.id, { weekday: 2 });
		await db.execute(
			sql`insert into availability_date_override (therapist_id, date) values (${therapistId}, ${target.key})`
		);
		const dateSlot = await mkSlot(therapistId, { weekday: null, overrideDate: target.key });

		expect((await reserveSlot(therapistId, '00000000-0000-0000-0000-000000000000', clientA)).error).toBe(
			'slot_not_found'
		);
		expect((await reserveSlot(therapistId, theirs.id, clientA)).error).toBe('slot_not_found');
		expect((await reserveSlot(therapistId, dateSlot.id, clientA)).error).toBe('slot_not_found');
	});

	it('rejects another therapist’s client and leaves the slot open', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const stranger = await mkClient(other.id);
		const slot = await mkSlot(therapistId, { weekday: 2 });

		expect((await reserveSlot(therapistId, slot.id, stranger.id)).error).toBe('client_not_found');
		expect((await slotRow(slot.id)).reservedClientId).toBeNull();
	});
});

describe('saveWeekDay', () => {
	it('saves one weekday’s cap and holiday and leaves the other six alone', async () => {
		await saveWeekDay(therapistId, 1, 3, false);
		await saveWeekDay(therapistId, 5, null, true);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[1].maxSessions).toBe(3);
		expect(design.week[1].holiday).toBe(false);
		expect(design.week[5].maxSessions).toBeNull();
		expect(design.week[5].holiday).toBe(true);
		for (const weekday of [0, 2, 3, 4, 6]) {
			expect(design.week[weekday].maxSessions).toBeNull();
			expect(design.week[weekday].holiday).toBe(false);
		}

		// read as text: this checks Postgres really stores NULLs for uncapped days
		const [settings] = await db
			.select({ weeklyMaxSessions: sql<string>`${therapistSettings.weeklyMaxSessions}::text` })
			.from(therapistSettings)
			.where(eq(therapistSettings.therapistId, therapistId));
		expect(settings.weeklyMaxSessions).toBe('{NULL,3,NULL,NULL,NULL,NULL,NULL}');
	});

	it('works for a therapist with no therapist_settings row', async () => {
		await db.delete(therapistSettings).where(eq(therapistSettings.therapistId, therapistId));

		await saveWeekDay(therapistId, 2, 4, true);

		const design = await getSlotDesign(therapistId, 2027, 0);
		expect(design.week[2].maxSessions).toBe(4);
		expect(design.week[2].holiday).toBe(true);
	});

	it('leaves the slots and another therapist’s settings alone', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		await saveWeekDay(other.id, 2, 7, false);
		await mkSlot(therapistId, { weekday: 2 });

		await saveWeekDay(therapistId, 2, 1, true);

		expect(await slotRows(therapistId)).toHaveLength(1);
		const otherDesign = await getSlotDesign(other.id, 2027, 0);
		expect(otherDesign.week[2].maxSessions).toBe(7);
		expect(otherDesign.week[2].holiday).toBe(false);
	});
});

describe('copyDay', () => {
	it('replaces the open slots on the target days with copies of the source day', async () => {
		await mkSlot(therapistId, { weekday: 1, startTime: '09:00', endTime: '10:00' });
		await mkSlot(therapistId, { weekday: 1, startTime: '11:00', endTime: '12:00', modality: 'in_person' });
		await mkSlot(therapistId, { weekday: 2, startTime: '15:00', endTime: '16:00' });

		await copyDay(therapistId, 1, [2, 3]);

		const design = await getSlotDesign(therapistId, 2027, 0);
		for (const weekday of [2, 3]) {
			const copied: string[] = [];
			for (const slot of design.week[weekday].slots) {
				copied.push(`${slot.startTime}-${slot.endTime}-${slot.modality}`);
			}
			expect(copied).toEqual(['09:00-10:00-online', '11:00-12:00-in_person']);
		}
		expect(design.week[1].slots).toHaveLength(2);
	});

	// the source day must differ from the target's weekday, whatever today is
	const source = (target.weekday + 1) % 7;

	it('leaves a reserved slot on a target day, and its holds, untouched', async () => {
		await mkSlot(therapistId, { weekday: source, startTime: '14:00', endTime: '15:00' });
		const reserved = await mkReserved(clientA);
		const before = await confirmedFor(clientA);

		await copyDay(therapistId, source, [target.weekday]);

		expect((await slotRow(reserved.id)).reservedClientId).toBe(clientA);
		expect(await confirmedFor(clientA)).toEqual(before);
	});

	it('skips a copy that would overlap a reserved slot on the target day', async () => {
		await mkSlot(therapistId, { weekday: source, startTime: '10:30', endTime: '11:30' });
		await mkSlot(therapistId, { weekday: source, startTime: '14:00', endTime: '15:00' });
		await mkReserved(clientA);

		await copyDay(therapistId, source, [target.weekday]);

		const design = await getSlotDesign(therapistId, 2027, 0);
		const times: string[] = [];
		for (const slot of design.week[target.weekday].slots) {
			times.push(slot.startTime);
		}
		expect(times).toEqual(['10:00', '14:00']);
	});

	it('copies never carry the source’s reservation', async () => {
		await mkSlot(therapistId, { weekday: 1, startTime: '09:00', endTime: '10:00', reservedClientId: clientA });

		await copyDay(therapistId, 1, [2]);

		const rows = await db
			.select()
			.from(availabilitySlot)
			.where(and(eq(availabilitySlot.therapistId, therapistId), eq(availabilitySlot.weekday, 2)));
		expect(rows).toHaveLength(1);
		expect(rows[0].reservedClientId).toBeNull();
	});

	it('copying a day onto itself changes nothing', async () => {
		const slot = await mkSlot(therapistId, { weekday: 1 });
		await copyDay(therapistId, 1, [1]);
		const rows = await slotRows(therapistId);
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe(slot.id);
	});

	it('only touches the signed-in therapist’s slots', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		await mkSlot(other.id, { weekday: 2, startTime: '08:00', endTime: '09:00' });
		await mkSlot(therapistId, { weekday: 1, startTime: '09:00', endTime: '10:00' });

		await copyDay(therapistId, 1, [2]);

		const theirs = await slotRows(other.id);
		expect(theirs).toHaveLength(1);
		expect(theirs[0].startTime.slice(0, 5)).toBe('08:00');
	});
});

describe('stale tab', () => {
	it('a slot added elsewhere survives another slot’s update and delete', async () => {
		const loaded = await mkSlot(therapistId, { weekday: 1, startTime: '09:00', endTime: '10:00' });
		const other = await mkSlot(therapistId, { weekday: 1, startTime: '12:00', endTime: '13:00' });
		// added from another tab after the first tab loaded
		const added = await addSlot(therapistId, { weekday: 3, startTime: '09:00', endTime: '10:00', modality: 'online' });

		await updateSlot(therapistId, loaded.id, { weekday: 1, startTime: '09:30', endTime: '10:30', modality: 'online' });
		await deleteSlot(therapistId, other.id);

		expect(await slotRow(added.id!)).toBeDefined();
	});
});
