import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { appointment, availabilitySlot, client, therapistSettings } from '$lib/server/db/schema';
import { deleteFutureHolds, materialiseReservedSlots, type MaterialiseResult } from '$lib/server/recurringBookings';
import { detachMeetingLink } from '$lib/server/appointments';
import { logError } from '$lib/server/log';
import type { SlotModality } from '$lib/types/slots';

// The weekly-template slot operations (docs/weekly slots.md). Each works on one slot by id,
// scoped to the therapist. Inputs are trusted: the calendar form actions validate them first.
// A reserved slot's time/client change deletes its future holds, then re-books after commit.

export type WeeklySlotInput = {
	weekday: number;
	startTime: string;
	endTime: string;
	modality: SlotModality;
};

type SlotRow = typeof availabilitySlot.$inferSelect;

export type SlotChangeResult = {
	error?: 'slot_not_found' | 'client_not_found' | 'hybrid_slot' | 'reserved_overlap';
	booking?: MaterialiseResult;
};

// "HH:MM" and Postgres "HH:MM:SS" compare the same once cut to 5 characters
function hhmm(time: string): string {
	return time.slice(0, 5);
}

function overlaps(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }): boolean {
	return hhmm(a.startTime) < hhmm(b.endTime) && hhmm(b.startTime) < hhmm(a.endTime);
}

async function findWeeklySlot(therapistId: string, slotId: string): Promise<SlotRow | undefined> {
	const [row] = await db
		.select()
		.from(availabilitySlot)
		.where(
			and(
				eq(availabilitySlot.id, slotId),
				eq(availabilitySlot.therapistId, therapistId),
				isNotNull(availabilitySlot.weekday)
			)
		);
	return row;
}

// the other weekly slots on `weekday`, leaving out `exceptId`
async function otherSlotsOnDay(therapistId: string, weekday: number, exceptId: string | null) {
	const conditions = [eq(availabilitySlot.therapistId, therapistId), eq(availabilitySlot.weekday, weekday)];
	if (exceptId !== null) {
		conditions.push(ne(availabilitySlot.id, exceptId));
	}
	return db.select().from(availabilitySlot).where(and(...conditions));
}

// A reserved slot may not overlap any other slot on its day, so an open slot may not overlap a
// reserved one either. Touching at the edge is fine.
async function breaksReservedRule(
	therapistId: string,
	time: WeeklySlotInput,
	selfId: string | null,
	selfReserved: boolean
): Promise<boolean> {
	const others = await otherSlotsOnDay(therapistId, time.weekday, selfId);
	for (const other of others) {
		if (!overlaps(time, other)) {
			continue;
		}
		if (selfReserved || other.reservedClientId !== null) {
			return true;
		}
	}
	return false;
}

// Meet events live at Google, so they go only once the holds are gone for good
async function detachAll(rows: (typeof appointment.$inferSelect)[]) {
	for (const row of rows) {
		try {
			await detachMeetingLink(row);
		} catch (err) {
			logError('weeklySlots.detachMeetingLink', err);
		}
	}
}

// Books the coming weeks once the change has committed. The change stands either way: on a
// failure this logs, reports nothing booked, and tonight's cron books the weeks instead.
async function rebook(slotId: string): Promise<MaterialiseResult | undefined> {
	try {
		return await materialiseReservedSlots({ slotId });
	} catch (err) {
		logError('weeklySlots.rebook', err);
		return undefined;
	}
}

export async function addSlot(therapistId: string, input: WeeklySlotInput): Promise<{ id?: string; error?: 'reserved_overlap' }> {
	if (await breaksReservedRule(therapistId, input, null, false)) {
		return { error: 'reserved_overlap' };
	}
	const [row] = await db
		.insert(availabilitySlot)
		.values({
			therapistId,
			weekday: input.weekday,
			startTime: input.startTime,
			endTime: input.endTime,
			modality: input.modality
		})
		.returning({ id: availabilitySlot.id });
	return { id: row.id };
}

export async function updateSlot(therapistId: string, slotId: string, input: WeeklySlotInput): Promise<SlotChangeResult> {
	const slot = await findWeeklySlot(therapistId, slotId);
	if (!slot) {
		return { error: 'slot_not_found' };
	}
	const reserved = slot.reservedClientId !== null;
	const changed =
		slot.weekday !== input.weekday ||
		hhmm(slot.startTime) !== input.startTime ||
		hhmm(slot.endTime) !== input.endTime ||
		slot.modality !== input.modality;
	if (!changed) {
		return {};
	}
	// a hybrid slot has no fixed modality, and nobody is there to pick one on an auto-booking
	if (reserved && input.modality === 'hybrid') {
		return { error: 'hybrid_slot' };
	}
	if (await breaksReservedRule(therapistId, input, slotId, reserved)) {
		return { error: 'reserved_overlap' };
	}

	const values = {
		weekday: input.weekday,
		startTime: input.startTime,
		endTime: input.endTime,
		modality: input.modality
	};
	if (!reserved) {
		// an open slot's bookings are ordinary appointments; they stay where they are
		await db.update(availabilitySlot).set(values).where(eq(availabilitySlot.id, slotId));
		return {};
	}

	const deleted = await db.transaction(async (tx) => {
		const holds = await deleteFutureHolds(tx, slotId);
		await tx.update(availabilitySlot).set(values).where(eq(availabilitySlot.id, slotId));
		return holds;
	});
	await detachAll(deleted);
	return { booking: await rebook(slotId) };
}

export async function deleteSlot(therapistId: string, slotId: string): Promise<{ error?: 'slot_not_found' }> {
	const slot = await findWeeklySlot(therapistId, slotId);
	if (!slot) {
		return { error: 'slot_not_found' };
	}
	// an open slot has no holds, so this only deletes the row. Past and cancelled holds of a
	// reserved slot stay; the FK unlinks them.
	const deleted = await db.transaction(async (tx) => {
		const holds = await deleteFutureHolds(tx, slotId);
		await tx.delete(availabilitySlot).where(eq(availabilitySlot.id, slotId));
		return holds;
	});
	await detachAll(deleted);
	return {};
}

/** Holds a weekly slot for one client every week, or releases it with null. */
export async function reserveSlot(
	therapistId: string,
	slotId: string,
	clientId: string | null
): Promise<SlotChangeResult> {
	const slot = await findWeeklySlot(therapistId, slotId);
	if (!slot) {
		return { error: 'slot_not_found' };
	}
	if (slot.reservedClientId === clientId) {
		return {};
	}

	if (clientId !== null) {
		if (slot.modality === 'hybrid') {
			return { error: 'hybrid_slot' };
		}
		const [clientRow] = await db
			.select({ id: client.id })
			.from(client)
			.where(and(eq(client.id, clientId), eq(client.therapistId, therapistId)));
		if (!clientRow) {
			return { error: 'client_not_found' };
		}
		const time = { weekday: slot.weekday!, startTime: slot.startTime, endTime: slot.endTime, modality: slot.modality };
		if (await breaksReservedRule(therapistId, time, slotId, true)) {
			return { error: 'reserved_overlap' };
		}
	}

	const deleted = await db.transaction(async (tx) => {
		const holds = await deleteFutureHolds(tx, slotId);
		await tx.update(availabilitySlot).set({ reservedClientId: clientId }).where(eq(availabilitySlot.id, slotId));
		return holds;
	});
	await detachAll(deleted);
	if (clientId === null) {
		return {};
	}
	return { booking: await rebook(slotId) };
}

/** Saves one weekday's session cap and holiday flag, leaving the other six as they are. */
export async function saveWeekDay(therapistId: string, weekday: number, maxSessions: number | null, holiday: boolean) {
	await db.transaction(async (tx) => {
		await tx.insert(therapistSettings).values({ therapistId }).onConflictDoNothing();
		const [settings] = await tx
			.select({ weeklyMaxSessions: therapistSettings.weeklyMaxSessions, weeklyHolidays: therapistSettings.weeklyHolidays })
			.from(therapistSettings)
			.where(eq(therapistSettings.therapistId, therapistId))
			.for('update');

		const weeklyMaxSessions: (number | null)[] = [];
		const weeklyHolidays: boolean[] = [];
		for (let day = 0; day < 7; day++) {
			// Drizzle reads a SQL NULL inside an int[] as NaN (see getSlotDesign)
			let cap: number | null = null;
			const stored = settings.weeklyMaxSessions?.[day];
			if (Number.isInteger(stored)) {
				cap = stored as number;
			}
			let isHoliday = settings.weeklyHolidays?.[day] === true;
			if (day === weekday) {
				cap = maxSessions;
				isHoliday = holiday;
			}
			weeklyMaxSessions.push(cap);
			weeklyHolidays.push(isHoliday);
		}

		await tx
			.update(therapistSettings)
			.set({ weeklyMaxSessions, weeklyHolidays })
			.where(eq(therapistSettings.therapistId, therapistId));
	});
}

/**
 * Replaces the open slots on each target weekday with copies of `fromWeekday`'s slots. Reserved
 * slots on a target day stay, and a copy that would overlap one is skipped. Copies are always open.
 */
export async function copyDay(therapistId: string, fromWeekday: number, targets: number[]) {
	const source = await otherSlotsOnDay(therapistId, fromWeekday, null);

	await db.transaction(async (tx) => {
		for (const weekday of new Set(targets)) {
			if (weekday === fromWeekday) {
				continue;
			}
			await copyOnto(tx, therapistId, weekday, source);
		}
	});
}

async function copyOnto(tx: DbOrTx, therapistId: string, weekday: number, source: SlotRow[]) {
	const onDay = and(eq(availabilitySlot.therapistId, therapistId), eq(availabilitySlot.weekday, weekday));
	await tx.delete(availabilitySlot).where(and(onDay, isNull(availabilitySlot.reservedClientId)));
	const reserved = await tx.select().from(availabilitySlot).where(onDay);

	const rows = [];
	for (const slot of source) {
		let blocked = false;
		for (const held of reserved) {
			if (overlaps(slot, held)) {
				blocked = true;
			}
		}
		if (blocked) {
			continue;
		}
		rows.push({
			therapistId,
			weekday,
			startTime: slot.startTime,
			endTime: slot.endTime,
			modality: slot.modality
		});
	}
	if (rows.length > 0) {
		await tx.insert(availabilitySlot).values(rows);
	}
}
