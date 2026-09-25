import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { availabilitySlot, availabilityDateOverride } from '$lib/server/db/schema';
import {
	toDateKey,
	parseDesignedSlots,
	getSlotDesign,
	listDesignedDaysForMonth,
	setDateOverride,
	clearDateOverride
} from '$lib/server/availabilitySlots';
import type { WeeklyDay, DesignedSlot } from '$lib/types/slots';
import { resetDb, mkTherapist, mkClient, mkSlot, mkWeek } from './helpers';

let therapistId: string;

// January 2027: the 1st is a Friday (weekday 5)
const Y = 2027;
const M = 0;

function slot(startTime: string, endTime: string, modality: DesignedSlot['modality'] = 'online'): DesignedSlot {
	return { startTime, endTime, modality };
}

function emptyWeek(): WeeklyDay[] {
	const week: WeeklyDay[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		week.push({ slots: [], maxSessions: null, holiday: false });
	}
	return week;
}

// weekly slots also carry their row id and reservation; these tests only care about the slot content
function bare<T extends { slots: DesignedSlot[] }>(day: T): T {
	const slots: DesignedSlot[] = [];
	for (const s of day.slots) {
		slots.push({ startTime: s.startTime, endTime: s.endTime, modality: s.modality });
	}
	return { ...day, slots };
}

async function slotRows(id: string) {
	return db.select().from(availabilitySlot).where(eq(availabilitySlot.therapistId, id));
}

// the Postgres error drizzle wraps, so constraint names can be asserted
async function dbError(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
	} catch (err) {
		let text = String(err);
		if (err instanceof Error && err.cause) {
			const cause = err.cause as { message?: string; constraint_name?: string };
			text = `${text} ${cause.message ?? ''} ${cause.constraint_name ?? ''}`;
		}
		return text;
	}
	throw new Error('expected the write to be rejected');
}

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ timezone: 'UTC' })).id;
});

describe('toDateKey', () => {
	it('zero-pads month and day and treats month as 0-indexed', () => {
		expect(toDateKey(2027, 0, 5)).toBe('2027-01-05');
		expect(toDateKey(2027, 11, 31)).toBe('2027-12-31');
	});
});

describe('parseDesignedSlots', () => {
	it('accepts an array of slot-shaped objects, dropping any id or reservation sent from the browser', () => {
		const parsed = parseDesignedSlots([
			{ startTime: '09:00', endTime: '10:00', modality: 'online', id: 'x', reservedClientId: 'someone', extra: 1 }
		]);
		expect(parsed).toEqual([slot('09:00', '10:00')]);
	});

	it('accepts an empty array (a day off)', () => {
		expect(parseDesignedSlots([])).toEqual([]);
	});

	it('returns null for anything that is not an array of slots', () => {
		expect(parseDesignedSlots(null)).toBeNull();
		expect(parseDesignedSlots('09:00')).toBeNull();
		expect(parseDesignedSlots({ startTime: '09:00' })).toBeNull();
		expect(parseDesignedSlots([null])).toBeNull();
		expect(parseDesignedSlots(['09:00'])).toBeNull();
		expect(parseDesignedSlots([{ startTime: '09:00', endTime: '10:00' }])).toBeNull();
		expect(parseDesignedSlots([{ startTime: 9, endTime: 10, modality: 'online' }])).toBeNull();
	});
});

describe('date overrides', () => {
	const dateKey = toDateKey(Y, M, 15);

	it('setting an override twice replaces its slots and cap', async () => {
		await setDateOverride(therapistId, dateKey, { slots: [slot('08:00', '09:00'), slot('09:00', '10:00')], maxSessions: 2 });
		await setDateOverride(therapistId, dateKey, { slots: [slot('16:00', '17:00')], maxSessions: null });

		const design = await getSlotDesign(therapistId, Y, M);
		expect(design.overrides[dateKey]).toEqual({ slots: [slot('16:00', '17:00')], maxSessions: null });
		expect(await slotRows(therapistId)).toHaveLength(1);
	});

	it('an override with no slots is a day off that still shows up in the design', async () => {
		await setDateOverride(therapistId, dateKey, { slots: [], maxSessions: null });
		const design = await getSlotDesign(therapistId, Y, M);
		expect(design.overrides[dateKey]).toEqual({ slots: [], maxSessions: null });
	});

	it('clearing an override removes its slots too (FK cascade)', async () => {
		await setDateOverride(therapistId, dateKey, { slots: [slot('08:00', '09:00')], maxSessions: 1 });
		await clearDateOverride(therapistId, dateKey);

		expect(await slotRows(therapistId)).toHaveLength(0);
		const overrides = await db
			.select()
			.from(availabilityDateOverride)
			.where(eq(availabilityDateOverride.therapistId, therapistId));
		expect(overrides).toHaveLength(0);
	});

	it('clearing one therapist’s override leaves another’s on the same date', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		await setDateOverride(other.id, dateKey, { slots: [slot('08:00', '09:00')], maxSessions: null });
		await setDateOverride(therapistId, dateKey, { slots: [slot('10:00', '11:00')], maxSessions: null });

		await clearDateOverride(therapistId, dateKey);

		const otherDesign = await getSlotDesign(other.id, Y, M);
		expect(otherDesign.overrides[dateKey].slots).toEqual([slot('08:00', '09:00')]);
	});

	it('clearing a date that has no override is a no-op', async () => {
		await clearDateOverride(therapistId, dateKey);
		expect(await slotRows(therapistId)).toHaveLength(0);
	});
});

describe('getSlotDesign', () => {
	it('returns HH:MM times sorted by start, whatever order they were saved in', async () => {
		const week = emptyWeek();
		week[2] = { slots: [slot('15:30', '16:30'), slot('08:15', '09:00'), slot('11:00', '12:00')], maxSessions: null, holiday: false };
		await mkWeek(therapistId, week);

		const design = await getSlotDesign(therapistId, Y, M);
		const starts: string[] = [];
		for (const s of design.week[2].slots) {
			starts.push(s.startTime);
		}
		expect(starts).toEqual(['08:15', '11:00', '15:30']);
		expect(design.week[2].slots[0].endTime).toBe('09:00');
	});

	it('only returns overrides inside the requested month, including its first and last day', async () => {
		await setDateOverride(therapistId, toDateKey(Y, M, 1), { slots: [], maxSessions: null });
		await setDateOverride(therapistId, toDateKey(Y, M, 31), { slots: [slot('09:00', '10:00')], maxSessions: null });
		await setDateOverride(therapistId, toDateKey(Y - 1, 11, 31), { slots: [], maxSessions: null });
		await setDateOverride(therapistId, toDateKey(Y, M + 1, 1), { slots: [slot('09:00', '10:00')], maxSessions: null });

		const design = await getSlotDesign(therapistId, Y, M);
		expect(Object.keys(design.overrides).sort()).toEqual(['2027-01-01', '2027-01-31']);
		expect(design.overrides['2027-01-31'].slots).toEqual([slot('09:00', '10:00')]);
	});

	it('reports the id and reservation of weekly slots', async () => {
		const reservedFor = await mkClient(therapistId);
		const tuesday = await mkSlot(therapistId, { weekday: 2, reservedClientId: reservedFor.id });
		const design = await getSlotDesign(therapistId, Y, M);
		expect(design.week[2].slots[0].id).toBe(tuesday.id);
		expect(design.week[2].slots[0].reservedClientId).toBe(reservedFor.id);
	});

	it('works for a therapist who has never designed anything', async () => {
		const design = await getSlotDesign(therapistId, Y, M);
		expect(design.week).toHaveLength(7);
		expect(design.overrides).toEqual({});
	});
});

describe('listDesignedDaysForMonth', () => {
	it('uses the weekday template, except on overridden dates', async () => {
		const week = emptyWeek();
		week[5] = { slots: [slot('09:00', '10:00')], maxSessions: 1, holiday: false }; // Fridays
		await mkWeek(therapistId, week);
		// Jan 8 2027 is a Friday — override it to a day off
		await setDateOverride(therapistId, toDateKey(Y, M, 8), { slots: [], maxSessions: null });

		const days = await listDesignedDaysForMonth(therapistId, Y, M);
		expect(Object.keys(days)).toHaveLength(31);
		expect(bare(days[1])).toEqual({ slots: [slot('09:00', '10:00')], maxSessions: 1 });
		expect(days[8]).toEqual({ slots: [], maxSessions: null });
		expect(bare(days[15])).toEqual({ slots: [slot('09:00', '10:00')], maxSessions: 1 });
		expect(days[2].slots).toEqual([]);
	});

	it('closes a holiday weekday but keeps its slots, and a date override still wins', async () => {
		const week = emptyWeek();
		week[5] = { slots: [slot('09:00', '10:00')], maxSessions: 1, holiday: true }; // Fridays
		await mkWeek(therapistId, week);
		// Jan 8 2027 is a Friday — open just that one
		await setDateOverride(therapistId, toDateKey(Y, M, 8), { slots: [slot('14:00', '15:00')], maxSessions: null });

		const days = await listDesignedDaysForMonth(therapistId, Y, M);
		expect(days[1]).toEqual({ slots: [], maxSessions: 1 });
		expect(days[8]).toEqual({ slots: [slot('14:00', '15:00')], maxSessions: null });

		const design = await getSlotDesign(therapistId, Y, M);
		expect(bare(design.week[5])).toEqual({ slots: [slot('09:00', '10:00')], maxSessions: 1, holiday: true });
		expect(design.week[4].holiday).toBe(false);
	});
});

describe('availability_slot constraints', () => {
	it('refuses a slot that ends before it starts', async () => {
		const message = await dbError(
			db.insert(availabilitySlot).values({ therapistId, weekday: 1, startTime: '10:00', endTime: '09:00', modality: 'online' })
		);
		expect(message).toContain('availabilitySlot_end_after_start');
	});

	it('refuses a slot with both a weekday and a date', async () => {
		const dateKey = toDateKey(Y, M, 15);
		await setDateOverride(therapistId, dateKey, { slots: [], maxSessions: null });
		const message = await dbError(
			db.insert(availabilitySlot).values({
				therapistId,
				weekday: 1,
				overrideDate: dateKey,
				startTime: '09:00',
				endTime: '10:00',
				modality: 'online'
			})
		);
		expect(message).toContain('availabilitySlot_weekday_xor_overrideDate');
	});

	it('refuses a slot with neither a weekday nor a date', async () => {
		const message = await dbError(
			db.insert(availabilitySlot).values({ therapistId, startTime: '09:00', endTime: '10:00', modality: 'online' })
		);
		expect(message).toContain('availabilitySlot_weekday_xor_overrideDate');
	});

	it('refuses a weekday outside 0–6', async () => {
		const message = await dbError(
			db.insert(availabilitySlot).values({ therapistId, weekday: 7, startTime: '09:00', endTime: '10:00', modality: 'online' })
		);
		expect(message).toContain('availabilitySlot_weekday_range');
	});

	it('refuses a date slot without a matching override row', async () => {
		const message = await dbError(
			db.insert(availabilitySlot).values({
				therapistId,
				overrideDate: toDateKey(Y, M, 20),
				startTime: '09:00',
				endTime: '10:00',
				modality: 'online'
			})
		);
		expect(message).toContain('availabilitySlot_override_fk');
	});
});
