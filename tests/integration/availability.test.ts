import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment } from '$lib/server/db/schema';
import {
	listAvailabilityForMonth,
	createAppointmentForClient,
	rescheduleAppointmentForClient
} from '$lib/server/availability';
import { cancelAppointment, createAppointmentForTherapist } from '$lib/server/appointments';
import { listDayKindsForMonth } from '$lib/server/schedule';
import {
	replaceWeekTemplate,
	setDateOverride,
	clearDateOverride,
	toDateKey,
	validateDaySlots,
	parseMaxSessions,
	type DesignedSlot,
	type DesignedDay
} from '$lib/server/availabilitySlots';
import { addCharge } from '$lib/server/payments';
import { resetDb, mkTherapist, mkClient, mkSettings, mkAppointment } from './helpers';

// therapist in UTC so wall-clock slot times line up with the UTC instants we insert
let therapistId: string;
let clientId: string;
// a date a few days out — inside the 14-day booking window, in the future
const target = new Date();
target.setUTCDate(target.getUTCDate() + 5);
target.setUTCHours(0, 0, 0, 0);
const y = target.getUTCFullYear();
const m = target.getUTCMonth();
const d = target.getUTCDate();
const targetWeekday = target.getUTCDay();

function at(hour: number) {
	return new Date(Date.UTC(y, m, d, hour, 0, 0));
}

function slot(startTime: string, endTime: string, modality: DesignedSlot['modality'] = 'online'): DesignedSlot {
	return { startTime, endTime, modality };
}

// the same slots on every day of the week
async function everyDay(slots: DesignedSlot[], maxSessions: number | null = null) {
	const week: DesignedDay[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		week.push({ slots, maxSessions });
	}
	await replaceWeekTemplate(therapistId, week);
}

const threeHourly = [slot('09:00', '10:00'), slot('10:00', '11:00'), slot('11:00', '12:00')];

beforeEach(async () => {
	await resetDb();
	const t = await mkTherapist({ timezone: 'UTC' });
	therapistId = t.id;
	clientId = (await mkClient(therapistId)).id;
});

describe('listAvailabilityForMonth', () => {
	it('offers nothing until the therapist builds slots', async () => {
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d]).toBeUndefined();
	});

	it('offers exactly the handcrafted weekly slots, any length, with their modality', async () => {
		await everyDay([slot('08:30', '09:20', 'in_person'), slot('18:00', '19:30', 'online')]);
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d]).toMatchObject([
			{ startTime: '08:30', endTime: '09:20', modality: 'in_person' },
			{ startTime: '18:00', endTime: '19:30', modality: 'online' }
		]);
	});

	it('a weekday with no slots is off', async () => {
		const week: DesignedDay[] = [];
		for (let weekday = 0; weekday < 7; weekday++) {
			week.push({ slots: threeHourly, maxSessions: null });
		}
		week[targetWeekday] = { slots: [], maxSessions: null };
		await replaceWeekTemplate(therapistId, week);
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d]).toBeUndefined();
	});

	it('a date override replaces that day’s template slots', async () => {
		await everyDay(threeHourly);
		await setDateOverride(therapistId, toDateKey(y, m, d), { slots: [slot('14:00', '15:00', 'hybrid')], maxSessions: null });
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d]).toMatchObject([{ startTime: '14:00', modality: 'hybrid' }]);
	});

	it('an empty date override is a day off, and clearing it restores the template', async () => {
		await everyDay(threeHourly);
		await setDateOverride(therapistId, toDateKey(y, m, d), { slots: [], maxSessions: null });
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toBeUndefined();

		await clearDateOverride(therapistId, toDateKey(y, m, d));
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toHaveLength(3);
	});

	it('a confirmed appointment blocks its own slot', async () => {
		await everyDay(threeHourly);
		await mkAppointment(therapistId, clientId, { startAt: at(10), endAt: at(11), status: 'confirmed' });
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d].map((s) => s.startTime)).toEqual(['09:00', '11:00']);
	});

	it('a cancelled appointment does not block anything', async () => {
		await everyDay(threeHourly);
		await mkAppointment(therapistId, clientId, { startAt: at(10), endAt: at(11), status: 'cancelled' });
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d].map((s) => s.startTime)).toContain('10:00');
	});

	it('nothing past the 14-day booking window', async () => {
		await everyDay(threeHourly);
		const far = new Date();
		far.setUTCDate(far.getUTCDate() + 20);
		const byDay = await listAvailabilityForMonth(therapistId, far.getUTCFullYear(), far.getUTCMonth());
		expect(byDay[far.getUTCDate()]).toBeUndefined();
	});
});

describe('client booking', () => {
	it('a booking lasts exactly its slot', async () => {
		await everyDay([slot('09:00', '09:45')]);
		const result = await createAppointmentForClient(therapistId, clientId, {
			year: y,
			month: m,
			day: d,
			startTime: '09:00'
		});
		expect(result.appointment!.endAt.getTime() - result.appointment!.startAt.getTime()).toBe(45 * 60_000);
	});

	it('rejects a time that is not a designed slot', async () => {
		await everyDay(threeHourly);
		const result = await createAppointmentForClient(therapistId, clientId, {
			year: y,
			month: m,
			day: d,
			startTime: '09:30'
		});
		expect(result.error).toBe('unavailable');
	});

	it('books with the client-chosen modality on a hybrid slot', async () => {
		await everyDay([slot('09:00', '10:00', 'hybrid')]);
		const result = await createAppointmentForClient(therapistId, clientId, {
			year: y,
			month: m,
			day: d,
			startTime: '09:00',
			modality: 'in_person'
		});
		expect(result.appointment?.modality).toBe('in_person');
	});

	it('rejects a hybrid-slot booking with no modality chosen', async () => {
		await everyDay([slot('09:00', '10:00', 'hybrid')]);
		const result = await createAppointmentForClient(therapistId, clientId, {
			year: y,
			month: m,
			day: d,
			startTime: '09:00'
		});
		expect(result.error).toBe('modality_required');
	});

	it('ignores a client-supplied modality on an online slot', async () => {
		await everyDay([slot('09:00', '10:00', 'online')]);
		const result = await createAppointmentForClient(therapistId, clientId, {
			year: y,
			month: m,
			day: d,
			startTime: '09:00',
			modality: 'in_person'
		});
		expect(result.appointment?.modality).toBe('online');
	});
});

describe('listDayKindsForMonth', () => {
	it('a day with no slots is off', async () => {
		const kinds = await listDayKindsForMonth(therapistId, y, m);
		expect(kinds[d]).toBe('off');
	});

	it('one modality across the day gives that kind, mixed gives hybrid', async () => {
		await everyDay([slot('09:00', '10:00', 'in_person')]);
		expect((await listDayKindsForMonth(therapistId, y, m))[d]).toBe('in_person');

		await everyDay([slot('09:00', '10:00', 'in_person'), slot('18:00', '19:00', 'online')]);
		expect((await listDayKindsForMonth(therapistId, y, m))[d]).toBe('hybrid');
	});

	it('a date override wins over the weekly template', async () => {
		await everyDay(threeHourly);
		await setDateOverride(therapistId, toDateKey(y, m, d), { slots: [], maxSessions: null });
		expect((await listDayKindsForMonth(therapistId, y, m))[d]).toBe('off');
	});
});

describe('validateDaySlots', () => {
	it('accepts back-to-back slots', () => {
		expect(validateDaySlots(threeHourly)).toBeNull();
	});

	it('rejects overlapping slots, backwards slots and bad times', () => {
		expect(validateDaySlots([slot('09:00', '10:00'), slot('09:30', '10:30')])).not.toBeNull();
		expect(validateDaySlots([slot('10:00', '09:00')])).not.toBeNull();
		expect(validateDaySlots([slot('9am', '10:00')])).not.toBeNull();
	});
});

describe('parseMaxSessions', () => {
	it('blank is no limit, 1–50 is a cap, anything else is invalid', () => {
		expect(parseMaxSessions('')).toBeNull();
		expect(parseMaxSessions(null)).toBeNull();
		expect(parseMaxSessions('3')).toBe(3);
		expect(parseMaxSessions(0)).toBeUndefined();
		expect(parseMaxSessions(51)).toBeUndefined();
		expect(parseMaxSessions(2.5)).toBeUndefined();
		expect(parseMaxSessions('abc')).toBeUndefined();
	});
});

describe('daily max sessions', () => {
	const fourHourly = [...threeHourly, slot('12:00', '13:00')];
	const book = (startTime: string) =>
		createAppointmentForClient(therapistId, clientId, { year: y, month: m, day: d, startTime });

	it('a full weekday shows no slots at all', async () => {
		await everyDay(fourHourly, 2);
		expect((await book('09:00')).appointment).toBeDefined();
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toHaveLength(3);

		expect((await book('10:00')).appointment).toBeDefined();
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toBeUndefined();
		expect(await book('11:00')).toEqual({ error: 'unavailable' });
	});

	it('a date’s own cap wins over the weekly cap', async () => {
		await everyDay(fourHourly, 3);
		await setDateOverride(therapistId, toDateKey(y, m, d), { slots: fourHourly, maxSessions: 1 });
		await book('09:00');
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toBeUndefined();
	});

	it('cancelling a session reopens a full day', async () => {
		await everyDay(fourHourly, 1);
		const booked = await book('09:00');
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toBeUndefined();

		await cancelAppointment(therapistId, booked.appointment!.id);
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toHaveLength(4);
	});

	it('a client can move a session to another time on the same full day', async () => {
		await everyDay(fourHourly, 1);
		const booked = await book('09:00');
		const moved = await rescheduleAppointmentForClient(therapistId, clientId, booked.appointment!.id, {
			year: y,
			month: m,
			day: d,
			startTime: '11:00'
		});
		expect('appointment' in moved).toBe(true);
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toBeUndefined();
	});

	it('the therapist’s own bookings count toward the cap', async () => {
		await everyDay(fourHourly, 1);
		const manual = await createAppointmentForTherapist(therapistId, {
			clientId,
			year: y,
			month: m,
			day: d,
			startHour: 15,
			startMinute: 0,
			endHour: 16,
			endMinute: 0,
			modality: 'online'
		});
		expect(manual.appointment).toBeDefined();
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toBeUndefined();
	});
});

describe('booking rules', () => {
	const book = (startTime: string) =>
		createAppointmentForClient(therapistId, clientId, { year: y, month: m, day: d, startTime });

	beforeEach(async () => {
		await everyDay([slot('09:00', '10:00'), slot('11:00', '12:00'), slot('13:00', '14:00')]);
	});

	it('blocks a portal booking once the client has the max upcoming sessions', async () => {
		await mkSettings(therapistId, { maxUpcomingBookingsPerClient: 1 });
		expect((await book('09:00')).appointment).toBeDefined();
		expect((await book('11:00')).error).toBe('booking_limit');
	});

	it('cancelled and past sessions do not count toward the limit', async () => {
		await mkSettings(therapistId, { maxUpcomingBookingsPerClient: 1 });
		await mkAppointment(therapistId, clientId, { startAt: at(10), endAt: at(11), status: 'cancelled' });
		await mkAppointment(therapistId, clientId, {
			startAt: new Date('2020-01-01T10:00:00Z'),
			endAt: new Date('2020-01-01T11:00:00Z')
		});
		expect((await book('13:00')).appointment).toBeDefined();
	});

	it('blocks a portal booking while an invoice is unpaid when requireZeroBalance is on', async () => {
		await mkSettings(therapistId, { requireZeroBalance: true });
		await addCharge(therapistId, { clientId, amount: 1000 });
		expect((await book('09:00')).error).toBe('balance_due');
	});
});

describe('therapist timezone', () => {
	it('stores a 10:00 Kolkata slot as 04:30 UTC and lists it back as 10:00', async () => {
		await resetDb();
		therapistId = (await mkTherapist({ timezone: 'Asia/Kolkata' })).id;
		clientId = (await mkClient(therapistId)).id;
		await everyDay([slot('10:00', '11:00')]);

		const result = await createAppointmentForClient(therapistId, clientId, { year: y, month: m, day: d, startTime: '10:00' });
		expect(result.appointment!.startAt).toEqual(new Date(Date.UTC(y, m, d, 4, 30)));
		expect(result.appointment!.endAt).toEqual(new Date(Date.UTC(y, m, d, 5, 30)));

		// the booked slot is now taken — the stored UTC instant maps back onto the same local slot
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toBeUndefined();
	});
});

describe('client reschedule', () => {
	const book = (startTime: string) =>
		createAppointmentForClient(therapistId, clientId, { year: y, month: m, day: d, startTime });
	const moveTo = (oldId: string, startTime: string, asClientId = clientId) =>
		rescheduleAppointmentForClient(therapistId, asClientId, oldId, { year: y, month: m, day: d, startTime });

	async function row(id: string) {
		const [found] = await db.select().from(appointment).where(eq(appointment.id, id));
		return found;
	}

	it('marks the old session rescheduled and links the new one to it', async () => {
		await everyDay(threeHourly);
		const booked = await book('09:00');
		const moved = await moveTo(booked.appointment!.id, '11:00');
		if (!('appointment' in moved)) {
			throw new Error(`reschedule failed: ${JSON.stringify(moved)}`);
		}

		expect((await row(booked.appointment!.id)).status).toBe('rescheduled');
		expect(moved.appointment.status).toBe('confirmed');
		expect(moved.appointment.rescheduledFromId).toBe(booked.appointment!.id);
		expect(moved.appointment.startAt).toEqual(at(11));
	});

	it('moves the Meet link onto the new session and off the old one', async () => {
		await everyDay(threeHourly);
		const old = await mkAppointment(therapistId, clientId, {
			startAt: at(9),
			endAt: at(10),
			meetLink: 'https://meet.google.com/abc-defg-hij',
			googleEventId: 'evt-1'
		});
		const moved = await moveTo(old.id, '11:00');
		if (!('appointment' in moved)) {
			throw new Error(`reschedule failed: ${JSON.stringify(moved)}`);
		}

		const newRow = await row(moved.appointment.id);
		expect(newRow.meetLink).toBe('https://meet.google.com/abc-defg-hij');
		expect(newRow.googleEventId).toBe('evt-1');
		const oldRow = await row(old.id);
		expect(oldRow.meetLink).toBeNull();
		expect(oldRow.googleEventId).toBeNull();
	});

	it('the rescheduled-away slot opens up again', async () => {
		await everyDay(threeHourly);
		const booked = await book('09:00');
		await moveTo(booked.appointment!.id, '11:00');

		const starts: string[] = [];
		for (const open of (await listAvailabilityForMonth(therapistId, y, m))[d]) {
			starts.push(open.startTime);
		}
		expect(starts).toEqual(['09:00', '10:00']);
	});

	it('a rescheduled session no longer counts toward the daily cap', async () => {
		await everyDay(threeHourly, 1);
		await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10), status: 'rescheduled' });
		expect((await listAvailabilityForMonth(therapistId, y, m))[d]).toHaveLength(3);
		expect((await book('10:00')).appointment).toBeDefined();
	});

	it('cannot reschedule into a slot someone else holds', async () => {
		await everyDay(threeHourly);
		const mine = await book('09:00');
		const otherClient = await mkClient(therapistId, { name: 'Other Client' });
		await createAppointmentForClient(therapistId, otherClient.id, { year: y, month: m, day: d, startTime: '11:00' });

		const moved = await moveTo(mine.appointment!.id, '11:00');
		expect('error' in moved).toBe(true);
		expect((await row(mine.appointment!.id)).status).toBe('confirmed');
	});

	it('a client cannot reschedule another client’s session', async () => {
		await everyDay(threeHourly);
		const otherClient = await mkClient(therapistId, { name: 'Other Client' });
		const theirs = await createAppointmentForClient(therapistId, otherClient.id, {
			year: y,
			month: m,
			day: d,
			startTime: '09:00'
		});

		expect(await moveTo(theirs.appointment!.id, '11:00')).toEqual({ error: 'not_found' });
		expect((await row(theirs.appointment!.id)).status).toBe('confirmed');
	});

	it('a client cannot reschedule a session belonging to another therapist', async () => {
		await everyDay(threeHourly);
		const other = await mkTherapist({ timezone: 'UTC' });
		const otherClient = await mkClient(other.id);
		const foreign = await mkAppointment(other.id, otherClient.id, { startAt: at(9), endAt: at(10) });
		expect(await moveTo(foreign.id, '11:00')).toEqual({ error: 'not_found' });
	});

	it('cannot reschedule a session that is already cancelled, rescheduled or completed', async () => {
		await everyDay(threeHourly);
		const statuses = ['cancelled', 'rescheduled', 'completed'] as const;
		for (const status of statuses) {
			const old = await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10), status });
			expect(await moveTo(old.id, '11:00')).toEqual({ error: 'not_found' });
		}
	});
});
