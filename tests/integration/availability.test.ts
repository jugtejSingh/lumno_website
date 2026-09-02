import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/server/db';
import { availabilityException } from '$lib/server/db/schema';
import { listAvailabilityForMonth } from '$lib/server/availability';
import { listDayKindsForMonth } from '$lib/server/schedule';
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

function at(hour: number) {
	return new Date(Date.UTC(y, m, d, hour, 0, 0));
}

beforeEach(async () => {
	await resetDb();
	const t = await mkTherapist({ timezone: 'UTC' });
	therapistId = t.id;
	clientId = (await mkClient(therapistId)).id;
});

describe('listAvailabilityForMonth', () => {
	it('offers hourly 09:00–19:00 slots on an open day (defaults)', async () => {
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d].map((s) => s.startTime)).toEqual([
			'09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
		]);
	});

	it('drops a day entirely when the weekday is off', async () => {
		await mkSettings(therapistId, { weeklySchedule: Array(7).fill('off') });
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d]).toBeUndefined();
	});

	it('an availability exception of kind "off" removes that day', async () => {
		await db.insert(availabilityException).values({
			therapistId,
			startAt: at(0),
			endAt: at(23),
			kind: 'off'
		});
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d]).toBeUndefined();
	});

	it('a confirmed appointment blocks its own slot', async () => {
		await mkAppointment(therapistId, clientId, { startAt: at(10), endAt: at(11), status: 'confirmed' });
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d].map((s) => s.startTime)).not.toContain('10:00');
		expect(byDay[d]).toHaveLength(10);
	});

	it('buffer minutes also block the adjacent slots', async () => {
		await mkSettings(therapistId, { bufferMinutes: 30 });
		await mkAppointment(therapistId, clientId, { startAt: at(10), endAt: at(11), status: 'confirmed' });
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		const times = byDay[d].map((s) => s.startTime);
		expect(times).not.toContain('09:00');
		expect(times).not.toContain('10:00');
		expect(times).not.toContain('11:00');
		expect(times).toContain('12:00');
	});

	it('a cancelled appointment does not block anything', async () => {
		await mkAppointment(therapistId, clientId, { startAt: at(10), endAt: at(11), status: 'cancelled' });
		const byDay = await listAvailabilityForMonth(therapistId, y, m);
		expect(byDay[d].map((s) => s.startTime)).toContain('10:00');
	});

	it('nothing past the 14-day booking window', async () => {
		const far = new Date();
		far.setUTCDate(far.getUTCDate() + 20);
		const byDay = await listAvailabilityForMonth(
			therapistId,
			far.getUTCFullYear(),
			far.getUTCMonth()
		);
		expect(byDay[far.getUTCDate()]).toBeUndefined();
	});
});

describe('listDayKindsForMonth', () => {
	it('defaults every day to online', async () => {
		const kinds = await listDayKindsForMonth(therapistId, y, m);
		expect(kinds[d]).toBe('online');
	});

	it('reflects the weekly schedule for that weekday', async () => {
		const weekday = new Date(Date.UTC(y, m, d)).getUTCDay();
		const week = Array(7).fill('online');
		week[weekday] = 'in_person';
		await mkSettings(therapistId, { weeklySchedule: week });
		const kinds = await listDayKindsForMonth(therapistId, y, m);
		expect(kinds[d]).toBe('in_person');
	});

	it('an exception overrides the weekly schedule', async () => {
		await db.insert(availabilityException).values({
			therapistId,
			startAt: at(0),
			endAt: at(23),
			kind: 'off'
		});
		const kinds = await listDayKindsForMonth(therapistId, y, m);
		expect(kinds[d]).toBe('off');
	});
});
