import { describe, it, expect, beforeEach, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { deleteMeetEvent, patchMeetEventTime } from '$lib/server/googleCalendar';
import { appointment, payment, paymentPack } from '$lib/server/db/schema';
import { rescheduleAppointmentForClient } from '$lib/server/availability';
import {
	cancelAppointment,
	rescheduleAppointmentForTherapist,
	markPastAppointmentsCompleted,
	listUpcomingAppointmentsForClient,
	parseDateParts,
	parseTimeParts
} from '$lib/server/appointments';
import { addCharge } from '$lib/server/payments';
import { resetDb, mkTherapist, mkClient, mkPack, mkAppointment, mkSlot } from './helpers';

let therapistId: string;
let clientId: string;

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);

async function appt(startAt: Date, over = {}) {
	return mkAppointment(therapistId, clientId, {
		startAt,
		endAt: new Date(startAt.getTime() + 3_600_000),
		...over
	});
}

async function feeRows(appointmentId: string) {
	return db
		.select()
		.from(payment)
		.where(and(eq(payment.appointmentId, appointmentId), eq(payment.clientId, clientId)));
}

beforeEach(async () => {
	await resetDb();
	const t = await mkTherapist({ timezone: 'UTC' });
	therapistId = t.id;
	clientId = (await mkClient(therapistId, { rate: 1000 })).id;
});

describe('listUpcomingAppointmentsForClient', () => {
	it('caps at the 5 soonest sessions', async () => {
		for (let i = 1; i <= 7; i++) {
			await appt(hoursFromNow(i * 24), { status: 'confirmed' });
		}
		const rows = await listUpcomingAppointmentsForClient(clientId, 'UTC');
		expect(rows).toHaveLength(5);
	});
});

describe('cancelAppointment', () => {
	it('not_found for an unknown id', async () => {
		expect(await cancelAppointment(therapistId, 'nope')).toEqual({ error: 'not_found' });
	});

	it('not_found for an already-cancelled appointment', async () => {
		const a = await appt(hoursFromNow(48), { status: 'cancelled' });
		expect(await cancelAppointment(therapistId, a.id)).toEqual({ error: 'not_found' });
	});

	it('not_found when the clientId does not match (one client cancelling another’s)', async () => {
		const a = await appt(hoursFromNow(48));
		const otherClient = await mkClient(therapistId);
		expect(await cancelAppointment(therapistId, a.id, otherClient.id)).toEqual({
			error: 'not_found'
		});
	});

	it('free tier (>=24h notice): cancels with no fee', async () => {
		const a = await appt(hoursFromNow(48));
		const res = await cancelAppointment(therapistId, a.id);
		expect(res).toEqual({ outcome: { tier: 'free', feeAmount: 0 } });

		const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
		expect(row.status).toBe('cancelled');
		expect(await feeRows(a.id)).toHaveLength(0);
	});

	it('clears the Meet link and deletes its Google event', async () => {
		const a = await appt(hoursFromNow(48), { meetLink: 'https://meet.google.com/abc', googleEventId: 'evt-1' });
		await cancelAppointment(therapistId, a.id);

		const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
		expect(row.meetLink).toBeNull();
		expect(row.googleEventId).toBeNull();
		expect(vi.mocked(deleteMeetEvent)).toHaveBeenCalledWith(expect.any(String), 'evt-1');
	});

	it('free-tier cancel returns the pack credit by clearing pack_id', async () => {
		const pack = await mkPack(therapistId, clientId);
		const a = await appt(hoursFromNow(48), { packId: pack.id });
		await cancelAppointment(therapistId, a.id);

		const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
		expect(row.packId).toBeNull();
	});

	it('full tier (<8h notice): a client cancelling is charged a 100% fee', async () => {
		const a = await appt(hoursFromNow(2));
		const res = await cancelAppointment(therapistId, a.id, clientId);
		expect(res).toEqual({ outcome: { tier: 'full', feeAmount: 1000 } });

		const fees = await feeRows(a.id);
		expect(fees).toHaveLength(1);
		expect(fees[0]).toMatchObject({ amount: 1000, note: 'Late cancellation fee (100%)', status: 'unpaid' });
	});

	it('partial tier (between 8h and 24h): a client cancelling is charged a 50% fee', async () => {
		const a = await appt(hoursFromNow(12));
		const res = await cancelAppointment(therapistId, a.id, clientId);
		expect(res).toEqual({ outcome: { tier: 'partial', feeAmount: 500 } });
		expect((await feeRows(a.id))[0]).toMatchObject({ amount: 500, note: 'Late cancellation fee (50%)' });
	});

	it('the therapist cancelling an upcoming session never charges the client, however late', async () => {
		const late = await appt(hoursFromNow(2));
		const partial = await appt(hoursFromNow(12));

		expect(await cancelAppointment(therapistId, late.id)).toEqual({ outcome: { tier: 'free', feeAmount: 0 } });
		expect(await cancelAppointment(therapistId, partial.id)).toEqual({ outcome: { tier: 'free', feeAmount: 0 } });
		expect(await feeRows(late.id)).toHaveLength(0);
		expect(await feeRows(partial.id)).toHaveLength(0);
	});

	it('the therapist cancelling a late pack session returns the credit', async () => {
		const pack = await mkPack(therapistId, clientId, { status: 'active' });
		const a = await appt(hoursFromNow(2), { packId: pack.id });
		await cancelAppointment(therapistId, a.id);

		const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
		expect(row.packId).toBeNull();
	});

	describe('a client cancelling a pack session', () => {
		it('at 50%: the credit comes back and no fee is charged', async () => {
			const pack = await mkPack(therapistId, clientId, { status: 'active' });
			const a = await appt(hoursFromNow(12), { packId: pack.id });

			const res = await cancelAppointment(therapistId, a.id, clientId);
			expect(res).toEqual({ outcome: { tier: 'partial', feeAmount: 500 } });

			const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
			expect(row.packId).toBeNull();
			expect(await feeRows(a.id)).toHaveLength(0);
		});

		it('at 100%: the credit is used up and no fee is charged', async () => {
			const pack = await mkPack(therapistId, clientId, { status: 'active' });
			const a = await appt(hoursFromNow(2), { packId: pack.id });

			await cancelAppointment(therapistId, a.id, clientId);

			const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
			expect(row.status).toBe('cancelled');
			expect(row.packId).toBe(pack.id);
			expect(await feeRows(a.id)).toHaveLength(0);
		});

		it('a returned credit reopens a pack that it had used up', async () => {
			const pack = await mkPack(therapistId, clientId, { status: 'completed', sessionCount: 1 });
			const a = await appt(hoursFromNow(48), { packId: pack.id });

			await cancelAppointment(therapistId, a.id, clientId);

			const [row] = await db.select().from(paymentPack).where(eq(paymentPack.id, pack.id));
			expect(row.status).toBe('active');
		});
	});

	describe('cancelling a completed session', () => {
		it('charge_required when the therapist gives no fee choice', async () => {
			const a = await appt(hoursFromNow(-48), { status: 'completed' });
			expect(await cancelAppointment(therapistId, a.id)).toEqual({ error: 'charge_required' });
		});

		it('not_found when a client tries it (clientId passed)', async () => {
			const a = await appt(hoursFromNow(-48), { status: 'completed' });
			expect(await cancelAppointment(therapistId, a.id, clientId, 'full')).toEqual({
				error: 'not_found'
			});
		});

		it('manual full tier: cancels and charges 100% of the client rate', async () => {
			const a = await appt(hoursFromNow(-48), { status: 'completed' });
			const res = await cancelAppointment(therapistId, a.id, undefined, 'full');
			expect(res).toEqual({ outcome: { tier: 'full', feeAmount: 1000 } });

			const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
			expect(row.status).toBe('cancelled');
			expect((await feeRows(a.id))[0]).toMatchObject({ amount: 1000, note: 'Late cancellation fee (100%)' });
		});

		it('manual free tier: cancels with no fee and returns the pack credit', async () => {
			const pack = await mkPack(therapistId, clientId);
			const a = await appt(hoursFromNow(-48), { status: 'completed', packId: pack.id });
			const res = await cancelAppointment(therapistId, a.id, undefined, 'free');
			expect(res).toEqual({ outcome: { tier: 'free', feeAmount: 0 } });

			const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
			expect(row.status).toBe('cancelled');
			expect(row.packId).toBeNull();
			expect(await feeRows(a.id)).toHaveLength(0);
		});
	});
});

describe('markPastAppointmentsCompleted', () => {
	it('flips only past confirmed rows, leaving future and non-confirmed rows alone', async () => {
		const past = await appt(hoursFromNow(-2));
		const future = await appt(hoursFromNow(48));
		const pastCancelled = await appt(hoursFromNow(-3), { status: 'cancelled' });

		await markPastAppointmentsCompleted(therapistId);

		const rows = await db.select().from(appointment).where(eq(appointment.therapistId, therapistId));
		const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]));
		expect(byId[past.id]).toBe('completed');
		expect(byId[future.id]).toBe('confirmed');
		expect(byId[pastCancelled.id]).toBe('cancelled');
	});
});

describe('rescheduleAppointmentForTherapist', () => {
	function inputAt(startAt: Date, modality: 'online' | 'in_person' = 'online') {
		return {
			year: startAt.getUTCFullYear(),
			month: startAt.getUTCMonth(),
			day: startAt.getUTCDate(),
			startHour: startAt.getUTCHours(),
			startMinute: 0,
			endHour: startAt.getUTCHours() + 1,
			endMinute: 0,
			modality
		};
	}

	it('not_found for an unknown appointment', async () => {
		expect(
			await rescheduleAppointmentForTherapist(therapistId, 'nope', inputAt(hoursFromNow(72)))
		).toEqual({ error: 'not_found' });
	});

	it('not_found for a completed appointment', async () => {
		const a = await appt(hoursFromNow(-48), { status: 'completed' });
		expect(await rescheduleAppointmentForTherapist(therapistId, a.id, inputAt(hoursFromNow(72)))).toEqual({
			error: 'not_found'
		});
	});

	it('flips the old row to rescheduled and creates a new confirmed row', async () => {
		const old = await appt(hoursFromNow(72));
		const newStart = new Date(Date.UTC(2026, 11, 1, 15, 0, 0));
		const res = await rescheduleAppointmentForTherapist(therapistId, old.id, inputAt(newStart));

		expect('appointment' in res).toBe(true);
		const [oldRow] = await db.select().from(appointment).where(eq(appointment.id, old.id));
		expect(oldRow.status).toBe('rescheduled');

		if ('appointment' in res) {
			expect(res.appointment.status).toBe('confirmed');
			expect(res.appointment.rescheduledFromId).toBe(old.id);
			expect(res.appointment.startAt.toISOString()).toBe(newStart.toISOString());
		}
	});

	it('moves financial links (payment rows + pack) onto the new appointment', async () => {
		const pack = await mkPack(therapistId, clientId);
		const old = await appt(hoursFromNow(72), { packId: pack.id });
		await addCharge(therapistId, { clientId, appointmentId: old.id, amount: 1000, note: 'session' });

		const res = await rescheduleAppointmentForTherapist(
			therapistId,
			old.id,
			inputAt(new Date(Date.UTC(2026, 11, 2, 9, 0, 0)))
		);
		if (!('appointment' in res)) throw new Error('expected success');

		const [sessionCharge] = await db
			.select()
			.from(payment)
			.where(eq(payment.note, 'session'));
		expect(sessionCharge.appointmentId).toBe(res.appointment.id);

		const [oldRow] = await db.select().from(appointment).where(eq(appointment.id, old.id));
		expect(oldRow.packId).toBeNull();
		expect(res.appointment.packId).toBe(pack.id);
	});

	it('moves the Meet link onto the new appointment and patches the Google event time', async () => {
		const old = await appt(hoursFromNow(72), { meetLink: 'https://meet.google.com/abc', googleEventId: 'evt-1' });
		const newStart = new Date(Date.UTC(2026, 11, 6, 9, 0, 0));
		const res = await rescheduleAppointmentForTherapist(therapistId, old.id, inputAt(newStart));
		if (!('appointment' in res)) throw new Error('expected success');

		expect(res.appointment.meetLink).toBe('https://meet.google.com/abc');
		expect(res.appointment.googleEventId).toBe('evt-1');
		const [oldRow] = await db.select().from(appointment).where(eq(appointment.id, old.id));
		expect(oldRow.meetLink).toBeNull();
		expect(oldRow.googleEventId).toBeNull();
		expect(vi.mocked(patchMeetEventTime)).toHaveBeenCalledWith(expect.any(String), 'evt-1', {
			startAt: newStart,
			endAt: new Date(newStart.getTime() + 3_600_000)
		});
	});

	it('free tier reschedule charges no fee', async () => {
		const old = await appt(hoursFromNow(72));
		const res = await rescheduleAppointmentForTherapist(
			therapistId,
			old.id,
			inputAt(new Date(Date.UTC(2026, 11, 3, 9, 0, 0)))
		);
		if (!('appointment' in res)) throw new Error('expected success');
		expect(res.outcome.tier).toBe('free');
		expect(await feeRows(res.appointment.id)).toHaveLength(0);
	});

	it('a late reschedule by the therapist never charges the client', async () => {
		const old = await appt(hoursFromNow(2));
		const res = await rescheduleAppointmentForTherapist(
			therapistId,
			old.id,
			inputAt(new Date(Date.UTC(2026, 11, 4, 9, 0, 0)))
		);
		if (!('appointment' in res)) throw new Error('expected success');
		expect(res.outcome).toEqual({ tier: 'free', feeAmount: 0 });
		expect(await feeRows(res.appointment.id)).toHaveLength(0);
	});

	it('a late reschedule by the client charges the fee against the new appointment', async () => {
		// one open slot, 10 days out
		const newDay = new Date(Date.now() + 10 * 86_400_000);
		await mkSlot(therapistId, { weekday: newDay.getUTCDay(), startTime: '09:00', endTime: '10:00' });
		const old = await appt(hoursFromNow(2));

		const res = await rescheduleAppointmentForClient(therapistId, clientId, old.id, {
			year: newDay.getUTCFullYear(),
			month: newDay.getUTCMonth(),
			day: newDay.getUTCDate(),
			startTime: '09:00'
		});
		if (!('appointment' in res)) throw new Error(`expected success, got ${JSON.stringify(res)}`);
		expect(res.outcome).toEqual({ tier: 'full', feeAmount: 1000 });
		expect((await feeRows(res.appointment.id))[0]).toMatchObject({
			amount: 1000,
			note: 'Late reschedule fee (100%)'
		});
	});

	it('overlap: returns { error: overlap } and leaves the old appointment confirmed', async () => {
		const old = await appt(hoursFromNow(72));
		const blockerStart = new Date(Date.UTC(2026, 11, 5, 14, 0, 0));
		await appt(blockerStart); // confirmed blocker

		const res = await rescheduleAppointmentForTherapist(therapistId, old.id, inputAt(blockerStart));
		expect(res).toMatchObject({ error: 'overlap' });

		const [oldRow] = await db.select().from(appointment).where(eq(appointment.id, old.id));
		expect(oldRow.status).toBe('confirmed');
		const all = await db.select().from(appointment).where(eq(appointment.therapistId, therapistId));
		expect(all).toHaveLength(2);
	});

});

describe('parseDateParts', () => {
	function form(year: string, month: string, day: string) {
		const data = new FormData();
		data.set('year', year);
		data.set('month', month);
		data.set('day', day);
		return data;
	}

	it('accepts a real date, month 0-indexed', () => {
		expect(parseDateParts(form('2027', '0', '31'))).toEqual({ year: 2027, month: 0, day: 31 });
		expect(parseDateParts(form('2027', '11', '31'))).toEqual({ year: 2027, month: 11, day: 31 });
	});

	it('rejects days that do not exist in that month', () => {
		expect(parseDateParts(form('2027', '1', '30'))).toBeNull();
		expect(parseDateParts(form('2027', '1', '29'))).toBeNull();
		expect(parseDateParts(form('2027', '3', '31'))).toBeNull();
		expect(parseDateParts(form('2027', '0', '0'))).toBeNull();
	});

	it('accepts Feb 29 only in a leap year', () => {
		expect(parseDateParts(form('2028', '1', '29'))).toEqual({ year: 2028, month: 1, day: 29 });
		expect(parseDateParts(form('2100', '1', '29'))).toBeNull();
	});

	it('rejects out-of-range and non-numeric parts', () => {
		expect(parseDateParts(form('2027', '12', '1'))).toBeNull();
		expect(parseDateParts(form('2027', '-1', '1'))).toBeNull();
		expect(parseDateParts(form('1969', '0', '1'))).toBeNull();
		expect(parseDateParts(form('2101', '0', '1'))).toBeNull();
		expect(parseDateParts(form('abc', '0', '1'))).toBeNull();
		expect(parseDateParts(form('2027', '0', '1.5'))).toBeNull();
		expect(parseDateParts(new FormData())).toBeNull();
	});
});

describe('parseTimeParts', () => {
	it('accepts real clock times', () => {
		expect(parseTimeParts('00:00')).toEqual({ hour: 0, minute: 0 });
		expect(parseTimeParts('23:59')).toEqual({ hour: 23, minute: 59 });
	});

	it('rejects anything that is not a clock time', () => {
		expect(parseTimeParts('24:00')).toBeNull();
		expect(parseTimeParts('12:60')).toBeNull();
		expect(parseTimeParts('12')).toBeNull();
		expect(parseTimeParts('')).toBeNull();
		expect(parseTimeParts('ab:cd')).toBeNull();
	});
});
