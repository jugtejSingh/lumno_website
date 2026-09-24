import { and, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	availabilitySlot,
	availabilityDateOverride,
	client,
	therapistSettings
} from '$lib/server/db/schema';
import type { DesignedDay, DesignedSlot, SlotModality, WeeklyDay } from '$lib/types/slots';

export type { DesignedDay, DesignedSlot, SlotModality, WeeklyDay };

const MAX_SESSIONS_LIMIT = 50;

const SLOT_MODALITIES: SlotModality[] = ['online', 'in_person', 'hybrid'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "YYYY-MM-DD" for a local calendar date; month is 0-indexed like the rest of the codebase. */
export function toDateKey(year: number, month: number, day: number): string {
	const monthText = String(month + 1).padStart(2, '0');
	const dayText = String(day).padStart(2, '0');
	return `${year}-${monthText}-${dayText}`;
}

// Postgres `time` comes back as "HH:MM:SS"; the designer works in "HH:MM"
// id and reservedClientId are only selected for weekly-template slots (date overrides can't be reserved)
function toDesignedSlot(row: {
	id?: string;
	reservedClientId?: string | null;
	startTime: string;
	endTime: string;
	modality: SlotModality;
}): DesignedSlot {
	const slot: DesignedSlot = {
		startTime: row.startTime.slice(0, 5),
		endTime: row.endTime.slice(0, 5),
		modality: row.modality
	};
	if (row.id !== undefined) {
		slot.id = row.id;
	}
	if (row.reservedClientId !== undefined) {
		slot.reservedClientId = row.reservedClientId;
	}
	return slot;
}

function sortByStart(slots: DesignedSlot[]): DesignedSlot[] {
	return [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Shapes untrusted form JSON into slots; null if it isn't an array of slot-shaped objects. */
export function parseDesignedSlots(raw: unknown): DesignedSlot[] | null {
	if (!Array.isArray(raw)) {
		return null;
	}
	const slots: DesignedSlot[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) {
			return null;
		}
		const { id, startTime, endTime, modality } = item as Record<string, unknown>;
		if (typeof startTime !== 'string' || typeof endTime !== 'string' || typeof modality !== 'string') {
			return null;
		}
		const slot: DesignedSlot = { startTime, endTime, modality: modality as SlotModality };
		if (id !== undefined && id !== null) {
			if (typeof id !== 'string') {
				return null;
			}
			slot.id = id;
		}
		// reservedClientId is deliberately never read from the browser here; see setSlotReservation
		slots.push(slot);
	}
	return slots;
}

/**
 * Shapes an untrusted max-sessions value: null/'' = no limit, a whole number 1–50 = that cap,
 * anything else = undefined (invalid).
 */
export function parseMaxSessions(raw: unknown): number | null | undefined {
	if (raw === null || raw === '') {
		return null;
	}
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1 || value > MAX_SESSIONS_LIMIT) {
		return undefined;
	}
	return value;
}

/** Returns an error message for a day's slots, or null when they're valid. */
export function validateDaySlots(slots: DesignedSlot[]): string | null {
	for (const slot of slots) {
		if (!TIME_PATTERN.test(slot.startTime) || !TIME_PATTERN.test(slot.endTime)) {
			return 'Every slot needs a valid start and end time';
		}
		if (slot.endTime <= slot.startTime) {
			return 'Every slot must end after it starts';
		}
		if (!SLOT_MODALITIES.includes(slot.modality)) {
			return 'Every slot needs online, in person or hybrid';
		}
	}
	const sorted = sortByStart(slots);
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i].startTime < sorted[i - 1].endTime) {
			return 'Slots on the same day can’t overlap';
		}
	}
	return null;
}

/** Weekly template (index 0 = Sunday) plus every overridden date in the month, for the designer. */
export async function getSlotDesign(therapistId: string, year: number, month: number) {
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const firstKey = toDateKey(year, month, 1);
	const lastKey = toDateKey(year, month, daysInMonth);

	const [settingsRows, templateRows, overrideRows, overrideSlotRows] = await Promise.all([
		db
			.select({
				weeklyMaxSessions: therapistSettings.weeklyMaxSessions,
				weeklyHolidays: therapistSettings.weeklyHolidays
			})
			.from(therapistSettings)
			.where(eq(therapistSettings.therapistId, therapistId)),
		db
			.select({
				id: availabilitySlot.id,
				reservedClientId: availabilitySlot.reservedClientId,
				weekday: availabilitySlot.weekday,
				startTime: availabilitySlot.startTime,
				endTime: availabilitySlot.endTime,
				modality: availabilitySlot.modality
			})
			.from(availabilitySlot)
			.where(and(eq(availabilitySlot.therapistId, therapistId), isNotNull(availabilitySlot.weekday))),
		db
			.select({ date: availabilityDateOverride.date, maxSessions: availabilityDateOverride.maxSessions })
			.from(availabilityDateOverride)
			.where(
				and(
					eq(availabilityDateOverride.therapistId, therapistId),
					gte(availabilityDateOverride.date, firstKey),
					lte(availabilityDateOverride.date, lastKey)
				)
			),
		db
			.select({
				overrideDate: availabilitySlot.overrideDate,
				startTime: availabilitySlot.startTime,
				endTime: availabilitySlot.endTime,
				modality: availabilitySlot.modality
			})
			.from(availabilitySlot)
			.where(
				and(
					eq(availabilitySlot.therapistId, therapistId),
					gte(availabilitySlot.overrideDate, firstKey),
					lte(availabilitySlot.overrideDate, lastKey)
				)
			)
	]);

	const weeklyMaxSessions = settingsRows[0]?.weeklyMaxSessions ?? [];
	const weeklyHolidays = settingsRows[0]?.weeklyHolidays ?? [];
	const week: WeeklyDay[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		// Drizzle reads a SQL NULL inside an int[] as the string "NULL" and parseInt()s it,
		// so an uncapped day arrives as NaN — anything that isn't a whole number means no cap
		let maxSessions: number | null = null;
		const stored = weeklyMaxSessions[weekday];
		if (Number.isInteger(stored)) {
			maxSessions = stored;
		}
		const holiday = weeklyHolidays[weekday] === true;
		week.push({ slots: [], maxSessions, holiday });
	}
	for (const row of templateRows) {
		week[row.weekday!].slots.push(toDesignedSlot(row));
	}
	for (const day of week) {
		day.slots = sortByStart(day.slots);
	}

	// every overridden date is present, even with zero slots (= day off)
	const overrides: Record<string, DesignedDay> = {};
	for (const row of overrideRows) {
		overrides[row.date] = { slots: [], maxSessions: row.maxSessions };
	}
	for (const row of overrideSlotRows) {
		overrides[row.overrideDate!].slots.push(toDesignedSlot(row));
	}
	for (const dateKey of Object.keys(overrides)) {
		overrides[dateKey].slots = sortByStart(overrides[dateKey].slots);
	}

	return { week, overrides };
}

/** Effective design for each day of the month: the date's override if it has one, else its weekday's template. */
export async function listDesignedDaysForMonth(therapistId: string, year: number, month: number) {
	const { week, overrides } = await getSlotDesign(therapistId, year, month);
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

	const designByDay: Record<number, DesignedDay> = {};
	for (let day = 1; day <= daysInMonth; day++) {
		const dateKey = toDateKey(year, month, day);
		if (dateKey in overrides) {
			designByDay[day] = overrides[dateKey];
		} else {
			// a calendar date's weekday doesn't depend on timezone
			const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
			// a holiday weekday keeps its slots in the template but offers none
			if (week[weekday].holiday) {
				designByDay[day] = { slots: [], maxSessions: week[weekday].maxSessions };
			} else {
				designByDay[day] = { slots: week[weekday].slots, maxSessions: week[weekday].maxSessions };
			}
		}
	}
	return designByDay;
}

/** Replaces the whole weekly template. `week` must have 7 entries, index 0 = Sunday. */
export async function replaceWeekTemplate(therapistId: string, week: WeeklyDay[]) {
	await db.transaction(async (tx) => {
		// Saved slots are updated or kept in place, never re-created: a reservation
		// (reservedClientId) lives on the row, so re-creating would lose it. Only ids that
		// are already this therapist's count as existing; any other id is treated as a new slot.
		const existingRows = await tx
			.select({
				id: availabilitySlot.id,
				weekday: availabilitySlot.weekday,
				startTime: availabilitySlot.startTime,
				endTime: availabilitySlot.endTime,
				modality: availabilitySlot.modality
			})
			.from(availabilitySlot)
			.where(and(eq(availabilitySlot.therapistId, therapistId), isNotNull(availabilitySlot.weekday)));
		const existingById = new Map<string, (typeof existingRows)[number]>();
		for (const row of existingRows) {
			existingById.set(row.id, row);
		}

		const keptIds = new Set<string>();
		const rowsToInsert = [];
		const weeklyMaxSessions: (number | null)[] = [];
		const weeklyHolidays: boolean[] = [];
		for (let weekday = 0; weekday < 7; weekday++) {
			for (const slot of week[weekday].slots) {
				let existing;
				if (slot.id !== undefined) {
					existing = existingById.get(slot.id);
				}
				// the same id twice (e.g. a copied day) only keeps the first; the rest are new slots
				if (existing !== undefined && keptIds.has(existing.id)) {
					existing = undefined;
				}
				if (existing === undefined) {
					rowsToInsert.push({
						therapistId,
						weekday,
						startTime: slot.startTime,
						endTime: slot.endTime,
						modality: slot.modality
					});
					continue;
				}

				keptIds.add(existing.id);
				const changed =
					existing.weekday !== weekday ||
					existing.startTime.slice(0, 5) !== slot.startTime ||
					existing.endTime.slice(0, 5) !== slot.endTime ||
					existing.modality !== slot.modality;
				if (changed) {
					await tx
						.update(availabilitySlot)
						.set({
							weekday,
							startTime: slot.startTime,
							endTime: slot.endTime,
							modality: slot.modality
						})
						.where(and(eq(availabilitySlot.id, existing.id), eq(availabilitySlot.therapistId, therapistId)));
				}
			}
			weeklyMaxSessions.push(week[weekday].maxSessions);
			weeklyHolidays.push(week[weekday].holiday);
		}

		const idsToDelete: string[] = [];
		for (const row of existingRows) {
			if (!keptIds.has(row.id)) {
				idsToDelete.push(row.id);
			}
		}
		if (idsToDelete.length > 0) {
			await tx
				.delete(availabilitySlot)
				.where(and(eq(availabilitySlot.therapistId, therapistId), inArray(availabilitySlot.id, idsToDelete)));
		}
		if (rowsToInsert.length > 0) {
			await tx.insert(availabilitySlot).values(rowsToInsert);
		}

		await tx
			.update(therapistSettings)
			.set({ weeklyMaxSessions, weeklyHolidays })
			.where(eq(therapistSettings.therapistId, therapistId));
	});
}

export type SetSlotReservationResult = {
	error?: 'slot_not_found' | 'client_not_found' | 'hybrid_slot';
};

/**
 * Holds a weekly-template slot for one client (or releases it with null). A separate action from
 * the weekly save on purpose: the save never touches reservedClientId, so it can't wipe or spoof
 * one. The nightly cron books reserved slots ahead (recurringBookings.ts).
 */
export async function setSlotReservation(
	therapistId: string,
	slotId: string,
	clientId: string | null
): Promise<SetSlotReservationResult> {
	const [slot] = await db
		.select({ weekday: availabilitySlot.weekday, modality: availabilitySlot.modality })
		.from(availabilitySlot)
		.where(and(eq(availabilitySlot.id, slotId), eq(availabilitySlot.therapistId, therapistId)));
	if (!slot || slot.weekday === null) {
		return { error: 'slot_not_found' };
	}

	if (clientId !== null) {
		// a hybrid slot has no fixed modality, and nobody is there to pick one on an auto-booking
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
	}

	await db
		.update(availabilitySlot)
		.set({ reservedClientId: clientId })
		.where(and(eq(availabilitySlot.id, slotId), eq(availabilitySlot.therapistId, therapistId)));
	return {};
}

/** Makes `dateKey` use exactly this design instead of its weekday's template. No slots = day off. */
export async function setDateOverride(therapistId: string, dateKey: string, design: DesignedDay) {
	await db.transaction(async (tx) => {
		// the FK cascade removes the date's previous slots with it
		await tx
			.delete(availabilityDateOverride)
			.where(
				and(eq(availabilityDateOverride.therapistId, therapistId), eq(availabilityDateOverride.date, dateKey))
			);
		await tx
			.insert(availabilityDateOverride)
			.values({ therapistId, date: dateKey, maxSessions: design.maxSessions });

		const rows = [];
		for (const slot of design.slots) {
			// built field by field: a browser-supplied id must never become a row's primary key
			rows.push({
				therapistId,
				overrideDate: dateKey,
				startTime: slot.startTime,
				endTime: slot.endTime,
				modality: slot.modality
			});
		}
		if (rows.length > 0) {
			await tx.insert(availabilitySlot).values(rows);
		}
	});
}

/** Puts `dateKey` back on its weekday's template. */
export async function clearDateOverride(therapistId: string, dateKey: string) {
	await db
		.delete(availabilityDateOverride)
		.where(and(eq(availabilityDateOverride.therapistId, therapistId), eq(availabilityDateOverride.date, dateKey)));
}
