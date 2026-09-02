import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { appointment, payment } from '$lib/server/db/schema';
import {
	cancelAppointment,
	rescheduleAppointmentForTherapist,
	markPastAppointmentsCompleted
} from '$lib/server/appointments';
import { addCharge } from '$lib/server/payments';
import { resetDb, mkTherapist, mkClient, mkPack, mkAppointment } from './helpers';

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

	it('free-tier cancel returns the pack credit by clearing pack_id', async () => {
		const pack = await mkPack(therapistId, clientId);
		const a = await appt(hoursFromNow(48), { packId: pack.id });
		await cancelAppointment(therapistId, a.id);

		const [row] = await db.select().from(appointment).where(eq(appointment.id, a.id));
		expect(row.packId).toBeNull();
	});

	it('full tier (<8h notice): cancels and charges a 100% fee', async () => {
		const a = await appt(hoursFromNow(2));
		const res = await cancelAppointment(therapistId, a.id);
		expect(res).toEqual({ outcome: { tier: 'full', feeAmount: 1000 } });

		const fees = await feeRows(a.id);
		expect(fees).toHaveLength(1);
		expect(fees[0]).toMatchObject({ amount: 1000, note: 'Late cancellation fee (100%)', status: 'unpaid' });
	});

	it('partial tier (between 8h and 24h): charges a 50% fee', async () => {
		const a = await appt(hoursFromNow(12));
		const res = await cancelAppointment(therapistId, a.id);
		expect(res).toEqual({ outcome: { tier: 'partial', feeAmount: 500 } });
		expect((await feeRows(a.id))[0]).toMatchObject({ amount: 500, note: 'Late cancellation fee (50%)' });
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

	it('late reschedule charges the fee against the new appointment', async () => {
		const old = await appt(hoursFromNow(2));
		const res = await rescheduleAppointmentForTherapist(
			therapistId,
			old.id,
			inputAt(new Date(Date.UTC(2026, 11, 4, 9, 0, 0)))
		);
		if (!('appointment' in res)) throw new Error('expected success');
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
		expect(res).toEqual({ error: 'overlap' });

		const [oldRow] = await db.select().from(appointment).where(eq(appointment.id, old.id));
		expect(oldRow.status).toBe('confirmed');
		const all = await db.select().from(appointment).where(eq(appointment.therapistId, therapistId));
		expect(all).toHaveLength(2);
	});

});
