import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment } from '$lib/server/db/schema';
import {
	createAppointmentForTherapist,
	rescheduleAppointmentForTherapist,
	isOverlapError
} from '$lib/server/appointments';
import { createAppointmentForClient } from '$lib/server/availability';
import type { WeeklyDay } from '$lib/types/slots';
import { resetDb, mkTherapist, mkClient, mkAppointment, mkWeek } from './helpers';

// Double-booking now that the buffer is gone: the JS pre-check (findOverlap) and the
// appointment_no_overlap trigger both treat ranges as half-open [start, end), so
// back-to-back sessions are fine and any real overlap is refused.

let therapistId: string;
let clientId: string;

// a fixed future day; therapist in UTC so wall-clock hours are UTC hours
const Y = 2026;
const M = 11; // December
const D = 10;

function at(hour: number, minute = 0) {
	return new Date(Date.UTC(Y, M, D, hour, minute, 0));
}

function book(startHour: number, startMinute: number, endHour: number, endMinute: number) {
	return createAppointmentForTherapist(therapistId, {
		clientId,
		year: Y,
		month: M,
		day: D,
		startHour,
		startMinute,
		endHour,
		endMinute,
		modality: 'online'
	});
}

// the error the trigger raises, however the driver wraps it
async function triggerError(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
	} catch (err) {
		let text = err instanceof Error ? err.message : String(err);
		if (err instanceof Error && err.cause instanceof Error) {
			text = `${text} ${err.cause.message}`;
		}
		return text;
	}
	throw new Error('expected the insert to be rejected');
}

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ timezone: 'UTC' })).id;
	clientId = (await mkClient(therapistId)).id;
});

describe('createAppointmentForTherapist overlap check', () => {
	it('allows back-to-back sessions on both sides', async () => {
		expect((await book(15, 0, 16, 0)).appointment).toBeDefined();
		expect((await book(16, 0, 17, 0)).appointment).toBeDefined();
		expect((await book(14, 0, 15, 0)).appointment).toBeDefined();
	});

	it('rejects a partial overlap and names the clashing session', async () => {
		await book(15, 0, 16, 0);
		const result = await book(15, 30, 16, 30);
		expect(result.error).toBe('overlap');
		expect(result.conflict).toEqual({ startAt: at(15), endAt: at(16) });
	});

	it('rejects a session inside another, and one that swallows another', async () => {
		await book(15, 0, 17, 0);
		expect((await book(15, 30, 16, 0)).error).toBe('overlap');

		await resetDb();
		therapistId = (await mkTherapist({ timezone: 'UTC' })).id;
		clientId = (await mkClient(therapistId)).id;
		await book(15, 30, 16, 0);
		expect((await book(15, 0, 17, 0)).error).toBe('overlap');
	});

	it('rejects the exact same slot', async () => {
		await book(15, 0, 16, 0);
		expect((await book(15, 0, 16, 0)).error).toBe('overlap');
	});

	it('cancelled, rescheduled and completed sessions do not block', async () => {
		await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10), status: 'cancelled' });
		await mkAppointment(therapistId, clientId, { startAt: at(11), endAt: at(12), status: 'rescheduled' });
		await mkAppointment(therapistId, clientId, { startAt: at(13), endAt: at(14), status: 'completed' });
		expect((await book(9, 0, 10, 0)).appointment).toBeDefined();
		expect((await book(11, 0, 12, 0)).appointment).toBeDefined();
		expect((await book(13, 0, 14, 0)).appointment).toBeDefined();
	});

	it('another therapist’s session at the same time does not block', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const otherClient = await mkClient(other.id);
		await mkAppointment(other.id, otherClient.id, { startAt: at(15), endAt: at(16) });
		expect((await book(15, 0, 16, 0)).appointment).toBeDefined();
	});

	it('rejects an end time that is not after the start', async () => {
		expect((await book(16, 0, 16, 0)).error).toBe('invalid_range');
		expect((await book(16, 0, 15, 0)).error).toBe('invalid_range');
	});
});

describe('appointment_no_overlap trigger (the race backstop)', () => {
	it('refuses a direct insert of an overlapping confirmed appointment', async () => {
		await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		const message = await triggerError(
			mkAppointment(therapistId, clientId, { startAt: at(15, 30), endAt: at(16, 30) })
		);
		expect(message).toContain('appointment_overlaps_existing_booking');
	});

	it('isOverlapError recognises the trigger error as drizzle actually throws it', async () => {
		// drizzle wraps it as "Failed query: …" with the postgres error on .cause
		await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		let caught: unknown = null;
		try {
			await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		} catch (err) {
			caught = err;
		}
		expect(isOverlapError(caught)).toBe(true);
	});

	it('isOverlapError ignores other errors', () => {
		expect(isOverlapError(new Error('duplicate key value'))).toBe(false);
		expect(isOverlapError(new Error('Failed query', { cause: new Error('deadlock detected') }))).toBe(false);
		expect(isOverlapError('appointment_overlaps_existing_booking')).toBe(false);
		expect(isOverlapError(null)).toBe(false);
	});

	it('two clients racing for one slot: one books, the other gets a clean error, never a throw', async () => {
		const week: WeeklyDay[] = [];
		for (let weekday = 0; weekday < 7; weekday++) {
			week.push({ slots: [{ startTime: '15:00', endTime: '16:00', modality: 'online' }], maxSessions: null, holiday: false });
		}
		await mkWeek(therapistId, week);
		const rival = await mkClient(therapistId, { name: 'Rival Client' });
		// a date inside the 14-day booking window
		const soon = new Date();
		soon.setUTCDate(soon.getUTCDate() + 3);
		const input = { year: soon.getUTCFullYear(), month: soon.getUTCMonth(), day: soon.getUTCDate(), startTime: '15:00' };

		for (let round = 0; round < 5; round++) {
			await db.delete(appointment).where(eq(appointment.therapistId, therapistId));
			const results = await Promise.all([
				createAppointmentForClient(therapistId, clientId, input),
				createAppointmentForClient(therapistId, rival.id, input)
			]);
			let booked = 0;
			for (const result of results) {
				if (result.appointment) {
					booked++;
				} else {
					expect(['overlap', 'unavailable']).toContain(result.error);
				}
			}
			expect(booked).toBe(1);
		}
	});

	it('allows back-to-back rows (half-open ranges, no buffer)', async () => {
		await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		await mkAppointment(therapistId, clientId, { startAt: at(16), endAt: at(17) });
		await mkAppointment(therapistId, clientId, { startAt: at(14), endAt: at(15) });
		const rows = await db.select().from(appointment).where(eq(appointment.therapistId, therapistId));
		expect(rows).toHaveLength(3);
	});

	it('allows an overlapping row that is not confirmed', async () => {
		await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16), status: 'cancelled' });
	});

	it('refuses reviving a cancelled appointment onto an occupied slot', async () => {
		const cancelled = await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16), status: 'cancelled' });
		await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		const message = await triggerError(
			db.update(appointment).set({ status: 'confirmed' }).where(eq(appointment.id, cancelled.id))
		);
		expect(message).toContain('appointment_overlaps_existing_booking');
	});

	it('does not block other therapists', async () => {
		const other = await mkTherapist({ timezone: 'UTC' });
		const otherClient = await mkClient(other.id);
		await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		await mkAppointment(other.id, otherClient.id, { startAt: at(15), endAt: at(16) });
	});
});

describe('therapist reschedule and overlap', () => {
	function slotInput(startHour: number, endHour: number) {
		return {
			year: Y,
			month: M,
			day: D,
			startHour,
			startMinute: 0,
			endHour,
			endMinute: 0,
			modality: 'online' as const
		};
	}

	it('can move a session to start exactly when its original slot ends', async () => {
		const old = await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		const result = await rescheduleAppointmentForTherapist(therapistId, old.id, slotInput(16, 17));
		expect('appointment' in result).toBe(true);
	});

	it('refuses a move that overlaps its own original slot (the old row is still confirmed at insert time)', async () => {
		const old = await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		const result = await rescheduleAppointmentForTherapist(therapistId, old.id, {
			...slotInput(15, 16),
			startMinute: 30,
			endMinute: 30
		});
		expect(result).toMatchObject({ error: 'overlap' });
		const [oldRow] = await db.select().from(appointment).where(eq(appointment.id, old.id));
		expect(oldRow.status).toBe('confirmed');
	});

	it('refuses a move onto another confirmed session and changes nothing', async () => {
		const old = await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10) });
		await mkAppointment(therapistId, clientId, { startAt: at(15), endAt: at(16) });
		const result = await rescheduleAppointmentForTherapist(therapistId, old.id, slotInput(15, 16));
		expect(result).toMatchObject({ error: 'overlap', conflict: { startAt: at(15), endAt: at(16) } });
		const rows = await db.select().from(appointment).where(eq(appointment.therapistId, therapistId));
		expect(rows).toHaveLength(2);
	});
});
