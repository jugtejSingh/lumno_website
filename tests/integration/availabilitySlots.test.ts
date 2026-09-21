import { describe, it, expect, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { availabilitySlot, availabilityDateOverride, therapistSettings } from '$lib/server/db/schema';
import {
	toDateKey,
	parseDesignedSlots,
	getSlotDesign,
	listDesignedDaysForMonth,
	replaceWeekTemplate,
	setDateOverride,
	clearDateOverride
} from '$lib/server/availabilitySlots';
import type { DesignedDay, DesignedSlot } from '$lib/types/slots';
import { resetDb, mkTherapist } from './helpers';

let therapistId: string;

// January 2027: the 1st is a Friday (weekday 5)
const Y = 2027;
const M = 0;

function slot(startTime: string, endTime: string, modality: DesignedSlot['modality'] = 'online'): DesignedSlot {
	return { startTime, endTime, modality };
}

function emptyWeek(): DesignedDay[] {
	const week: DesignedDay[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		week.push({ slots: [], maxSessions: null });
	}
	return week;
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
	it('accepts an array of slot-shaped objects and drops extra keys', () => {
		const parsed = parseDesignedSlots([{ startTime: '09:00', endTime: '10:00', modality: 'online', id: 'x' }]);
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

describe('replaceWeekTemplate', () => {
	it('stores the slots and the per-weekday caps', async () => {
		const week = emptyWeek();
		week[1] = { slots: [slot('09:00', '10:00'), slot('11:00', '12:00', 'hybrid')], maxSessions: 2 };
		week[3] = { slots: [slot('14:00', '15:00', 'in_person')], maxSessions: null };
		await replaceWeekTemplate(therapistId, week);

		const design = await getSlotDesign(therapistId, Y, M);
		expect(design.week[1]).toEqual({
			slots: [slot('09:00', '10:00'), slot('11:00', '12:00', 'hybrid')],
			maxSessions: 2
		});
		expect(design.week[3]).toEqual({ slots: [slot('14:00', '15:00', 'in_person')], maxSessions: null });
		expect(design.week[0]).toEqual({ slots: [], maxSessions: null });

		// read as text: drizzle's own int[] parse turns NULL elements into NaN (getSlotDesign
		// cleans that up), this checks Postgres really stores NULLs
		const [settings] = await db
			.select({ weeklyMaxSessions: sql<string>`${therapistSettings.weeklyMaxSessions}::text` })
			.from(therapistSettings)
			.where(eq(therapistSettings.therapistId, therapistId));
		expect(settings.weeklyMaxSessions).toBe('{NULL,2,NULL,NULL,NULL,NULL,NULL}');
	});

	it('replaces the previous template instead of appending to it', async () => {
		const first = emptyWeek();
		first[1] = { slots: [slot('09:00', '10:00'), slot('10:00', '11:00')], maxSessions: 5 };
		await replaceWeekTemplate(therapistId, first);

		const second = emptyWeek();
		second[2] = { slots: [slot('13:00', '14:00')], maxSessions: null };
		await replaceWeekTemplate(therapistId, second);

		const rows = await slotRows(therapistId);
		expect(rows).toHaveLength(1);
		expect(rows[0].weekday).toBe(2);
		const design = await getSlotDesign(therapistId, Y, M);
		expect(design.week[1]).toEqual({ slots: [], maxSessions: null });
	});

	it('an empty week clears every template slot', async () => {
		const week = emptyWeek();
		week[4] = { slots: [slot('09:00', '10:00')], maxSessions: null };
		await replaceWeekTemplate(therapistId, week);
		await replaceWeekTemplate(therapistId, emptyWeek());
		expect(await slotRows(therapistId)).toHaveLength(0);
	});

	it('leaves date overrides alone', async () => {
		const dateKey = toDateKey(Y, M, 15);
		await setDateOverride(therapistId, dateKey, { slots: [slot('08:00', '09:00')], maxSessions: 1 });
		await replaceWeekTemplate(therapistId, emptyWeek());

		const design = await getSlotDesign(therapistId, Y, M);
		expect(design.overrides[dateKey]).toEqual({ slots: [slot('08:00', '09:00')], maxSessions: 1 });
	});

	it('does not touch another therapist’s template', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const otherWeek = emptyWeek();
		otherWeek[1] = { slots: [slot('09:00', '10:00')], maxSessions: 3 };
		await replaceWeekTemplate(other.id, otherWeek);

		await replaceWeekTemplate(therapistId, emptyWeek());

		expect(await slotRows(other.id)).toHaveLength(1);
		const otherDesign = await getSlotDesign(other.id, Y, M);
		expect(otherDesign.week[1].maxSessions).toBe(3);
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
		week[2] = { slots: [slot('15:30', '16:30'), slot('08:15', '09:00'), slot('11:00', '12:00')], maxSessions: null };
		await replaceWeekTemplate(therapistId, week);

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

	it('works for a therapist who has never designed anything', async () => {
		const design = await getSlotDesign(therapistId, Y, M);
		expect(design.week).toHaveLength(7);
		expect(design.overrides).toEqual({});
	});
});

describe('listDesignedDaysForMonth', () => {
	it('uses the weekday template, except on overridden dates', async () => {
		const week = emptyWeek();
		week[5] = { slots: [slot('09:00', '10:00')], maxSessions: 1 }; // Fridays
		await replaceWeekTemplate(therapistId, week);
		// Jan 8 2027 is a Friday — override it to a day off
		await setDateOverride(therapistId, toDateKey(Y, M, 8), { slots: [], maxSessions: null });

		const days = await listDesignedDaysForMonth(therapistId, Y, M);
		expect(Object.keys(days)).toHaveLength(31);
		expect(days[1]).toEqual({ slots: [slot('09:00', '10:00')], maxSessions: 1 });
		expect(days[8]).toEqual({ slots: [], maxSessions: null });
		expect(days[15]).toEqual({ slots: [slot('09:00', '10:00')], maxSessions: 1 });
		expect(days[2].slots).toEqual([]);
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
