import { describe, it, expect, beforeEach } from 'vitest';
import {
	addCharge,
	setPaymentStatus,
	hasOutstandingBalance,
	createPack,
	cancelPack,
	listPacksForTherapist,
	updatePack,
	getActivePackForClient,
	completePackIfExhausted,
	listOutstandingBalancesByClient,
	getClientPaymentTotals,
	listPaymentsForClientPage,
	getPaymentSummary,
	listVisiblePaymentsForClient,
	getBalanceDueForClient
} from '$lib/server/payments';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { payment } from '$lib/server/db/schema';
import { parsePeriod } from '$lib/server/period';
import { resetDb, mkTherapist, mkClient, mkAppointment } from './helpers';

let therapistId: string;
let clientId: string;

// the payment rows that carry a pack's price
function purchaseRows(packId: string) {
	return db.select().from(payment).where(eq(payment.packId, packId));
}

beforeEach(async () => {
	await resetDb();
	const t = await mkTherapist();
	therapistId = t.id;
	clientId = (await mkClient(therapistId)).id;
});

describe('charges and balance', () => {
	it('an unpaid charge is an outstanding balance until marked paid', async () => {
		const p = await addCharge(therapistId, { clientId, amount: 1200 });
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(true);

		await setPaymentStatus(therapistId, p.id, 'paid');
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(false);
	});

	it('listOutstandingBalancesByClient sums unpaid charges and unpaid pack purchases, per client', async () => {
		await addCharge(therapistId, { clientId, amount: 1000 });
		await createPack(therapistId, { clientId, sessionCount: 5, amount: 5000, paid: false });

		const rows = await listOutstandingBalancesByClient(therapistId);
		expect(rows).toEqual([{ key: clientId, clientId, name: 'Test Client', owed: 6000 }]);
	});

	it('getClientPaymentTotals splits owed vs paid', async () => {
		const a = await addCharge(therapistId, { clientId, amount: 1000 });
		await addCharge(therapistId, { clientId, amount: 500 });
		await setPaymentStatus(therapistId, a.id, 'paid');

		const totals = await getClientPaymentTotals(therapistId, clientId);
		expect(totals.owed).toBe(500);
		expect(totals.paidThisMonth).toBe(1000);
		expect(totals.paidThisYear).toBe(1000);
	});

	it('listPaymentsForClientPage puts unpaid first, then newest first', async () => {
		const first = await addCharge(therapistId, { clientId, amount: 100, note: 'first' });
		await addCharge(therapistId, { clientId, amount: 200, note: 'second' });
		const third = await addCharge(therapistId, { clientId, amount: 300, note: 'third' });
		// the oldest and the newest are paid; only the middle one is still owed
		await setPaymentStatus(therapistId, first.id, 'paid');
		await setPaymentStatus(therapistId, third.id, 'paid');

		const { rows, total } = await listPaymentsForClientPage(therapistId, clientId, 1, 10);
		expect(total).toBe(3);
		expect(rows.map((r) => r.note)).toEqual(['second', 'third', 'first']);
	});

	it('getPaymentSummary counts an ad-hoc charge from the day it was added', async () => {
		await addCharge(therapistId, { clientId, amount: 1000 });
		const summary = await getPaymentSummary(therapistId, new Date(Date.now() - 86_400_000), null);
		expect(summary).toEqual({ paid: 0, unpaid: 1000, total: 1000 });
	});
});

describe('payment summary by period', () => {
	const DAY = 86_400_000;
	const tz = 'Asia/Kolkata';
	const now = new Date('2026-11-12T04:30:00Z');

	// a session charge with its created / paid dates set by hand
	async function sessionCharge(startAt: Date, amount: number, dates: { createdAt?: Date; paidAt?: Date } = {}) {
		const appt = await mkAppointment(therapistId, clientId, { startAt, endAt: new Date(startAt.getTime() + 3_600_000) });
		const p = await addCharge(therapistId, { clientId, appointmentId: appt.id, amount });
		const set: Partial<typeof payment.$inferInsert> = {};
		if (dates.createdAt) {
			set.createdAt = dates.createdAt;
		}
		if (dates.paidAt) {
			set.status = 'paid';
			set.paidAt = dates.paidAt;
		}
		if (Object.keys(set).length > 0) {
			await db.update(payment).set(set).where(eq(payment.id, p.id));
		}
		return p;
	}

	async function summaryFor(raw: string) {
		const period = parsePeriod(raw, tz, now);
		return getPaymentSummary(therapistId, period.start, period.end);
	}

	it('booked 30 Oct, session 6 Nov, paid 3 Dec: counts in November and 2026 only', async () => {
		await sessionCharge(new Date('2026-11-06T05:00:00Z'), 1500, {
			createdAt: new Date('2026-10-30T05:00:00Z'),
			paidAt: new Date('2026-12-03T05:00:00Z')
		});

		expect(await summaryFor('month:2026-11')).toEqual({ paid: 1500, unpaid: 0, total: 1500 });
		expect(await summaryFor('month:2026-10')).toEqual({ paid: 0, unpaid: 0, total: 0 });
		expect(await summaryFor('year:2026')).toEqual({ paid: 1500, unpaid: 0, total: 1500 });
		// rolling window: in while 6 Nov is inside it, out once it isn't
		expect((await getPaymentSummary(therapistId, new Date('2026-11-01T00:00:00Z'), null)).paid).toBe(1500);
		expect((await getPaymentSummary(therapistId, new Date('2026-11-07T00:00:00Z'), null)).paid).toBe(0);
	});

	it('a 45-day-late payment stays in the session month', async () => {
		await sessionCharge(new Date('2026-08-10T05:00:00Z'), 900, { paidAt: new Date('2026-09-24T05:00:00Z') });

		expect((await summaryFor('month:2026-08')).paid).toBe(900);
		expect((await summaryFor('month:2026-09')).paid).toBe(0);
	});

	it('an unpaid session that has not started is not counted; once started it is', async () => {
		await sessionCharge(new Date(Date.now() + 2 * 3_600_000), 1000);
		await sessionCharge(new Date(Date.now() - 2 * 3_600_000), 700);

		const summary = await getPaymentSummary(therapistId, new Date(Date.now() - 30 * DAY), null);
		expect(summary).toEqual({ paid: 0, unpaid: 700, total: 700 });
	});

	it('a prepaid session next week counts as paid in the last 30 days; unpaid it counts nowhere', async () => {
		const prepaid = await sessionCharge(new Date(Date.now() + 7 * DAY), 1200, { paidAt: new Date() });
		const since = new Date(Date.now() - 30 * DAY);
		expect(await getPaymentSummary(therapistId, since, null)).toEqual({ paid: 1200, unpaid: 0, total: 1200 });

		await db.update(payment).set({ status: 'unpaid', paidAt: null }).where(eq(payment.id, prepaid.id));
		expect(await getPaymentSummary(therapistId, since, null)).toEqual({ paid: 0, unpaid: 0, total: 0 });
	});

	it('a cancelled future session still counts as unpaid', async () => {
		const appt = await mkAppointment(therapistId, clientId, {
			startAt: new Date(Date.now() + 3 * DAY),
			endAt: new Date(Date.now() + 3 * DAY + 3_600_000),
			status: 'cancelled'
		});
		await addCharge(therapistId, { clientId, appointmentId: appt.id, amount: 500 });

		expect((await getPaymentSummary(therapistId, new Date(Date.now() - DAY), null)).unpaid).toBe(500);
	});
});

describe('who owes you', () => {
	it('includes an unpaid charge older than 365 days', async () => {
		const old = new Date(Date.now() - 400 * 86_400_000);
		const appt = await mkAppointment(therapistId, clientId, { startAt: old, endAt: new Date(old.getTime() + 3_600_000) });
		await addCharge(therapistId, { clientId, appointmentId: appt.id, amount: 800 });

		expect(await listOutstandingBalancesByClient(therapistId)).toEqual([
			{ key: clientId, clientId, name: 'Test Client', owed: 800 }
		]);
	});

	it('leaves out an unpaid session that has not started, even within the 2-day portal window', async () => {
		const soon = new Date(Date.now() + 86_400_000);
		const appt = await mkAppointment(therapistId, clientId, { startAt: soon, endAt: new Date(soon.getTime() + 3_600_000) });
		await addCharge(therapistId, { clientId, appointmentId: appt.id, amount: 800 });

		expect(await listOutstandingBalancesByClient(therapistId)).toEqual([]);
		// the client portal still shows it as due
		expect((await listVisiblePaymentsForClient(clientId, 1, 5)).rows).toHaveLength(1);
	});
});

describe('client-visible payments', () => {
	it('hides an unpaid charge for a session more than 2 days away', async () => {
		const future = await mkAppointment(therapistId, clientId, {
			startAt: new Date(Date.now() + 3 * 86_400_000),
			endAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000)
		});
		await addCharge(therapistId, { clientId, appointmentId: future.id, amount: 1000 });
		expect((await listVisiblePaymentsForClient(clientId, 1, 5)).rows).toHaveLength(0);
	});

	it('shows an unpaid charge from 2 days before the session', async () => {
		const soon = await mkAppointment(therapistId, clientId, {
			startAt: new Date(Date.now() + 86_400_000),
			endAt: new Date(Date.now() + 86_400_000 + 3_600_000)
		});
		await addCharge(therapistId, { clientId, appointmentId: soon.id, amount: 1000 });
		expect((await listVisiblePaymentsForClient(clientId, 1, 5)).rows).toHaveLength(1);
	});

	it('shows an unpaid charge once the session is over', async () => {
		const past = await mkAppointment(therapistId, clientId, {
			startAt: new Date(Date.now() - 7_200_000),
			endAt: new Date(Date.now() - 3_600_000)
		});
		await addCharge(therapistId, { clientId, appointmentId: past.id, amount: 1000 });
		expect((await listVisiblePaymentsForClient(clientId, 1, 5)).rows).toHaveLength(1);
	});

	it('never shows a paid charge to the client', async () => {
		const p = await addCharge(therapistId, { clientId, amount: 1000 });
		await setPaymentStatus(therapistId, p.id, 'paid');
		expect((await listVisiblePaymentsForClient(clientId, 1, 5)).rows).toHaveLength(0);
	});

	it('paginates visible payments and reports the true total', async () => {
		for (let i = 0; i < 7; i++) {
			await addCharge(therapistId, { clientId, amount: 100 });
		}
		const page1 = await listVisiblePaymentsForClient(clientId, 1, 5);
		expect(page1.rows).toHaveLength(5);
		expect(page1.total).toBe(7);

		const page2 = await listVisiblePaymentsForClient(clientId, 2, 5);
		expect(page2.rows).toHaveLength(2);

		expect(await getBalanceDueForClient(clientId)).toBe(700);
	});
});

describe('packs', () => {
	it('createPack is usable straight away, even unpaid, and counts as owed until its price is paid', async () => {
		const result = await createPack(therapistId, {
			clientId,
			sessionCount: 4,
			amount: 4000,
			paid: false
		});
		const pack = result.pack!;
		expect(pack.status).toBe('active');
		expect(await getActivePackForClient(clientId)).toMatchObject({ id: pack.id, remaining: 4 });
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(true);

		const [purchase] = await purchaseRows(pack.id);
		await setPaymentStatus(therapistId, purchase.id, 'paid');
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(false);
	});

	it('createPack writes one purchase row carrying the price, not tied to any session', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 4,
			amount: 4000,
			paid: false
		});

		const rows = await purchaseRows(pack!.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			therapistId,
			clientId,
			appointmentId: null,
			amount: 4000,
			note: 'Pack: 4 sessions',
			status: 'unpaid',
			paidAt: null
		});
	});

	it('a pack created as paid has a paid purchase row and is not owed', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 1,
			amount: 1000,
			paid: true
		});

		const [purchase] = await purchaseRows(pack!.id);
		expect(purchase.status).toBe('paid');
		expect(purchase.paidAt).not.toBeNull();
		expect(purchase.note).toBe('Pack: 1 session');
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(false);
	});

	it('remaining decreases as appointments are booked against the pack', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 2,
			amount: 2000,
			paid: true
		});
		await mkAppointment(therapistId, clientId, { packId: pack!.id });

		expect((await getActivePackForClient(clientId))!.remaining).toBe(1);
	});

	it('completePackIfExhausted flips the pack to completed at zero remaining', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 1,
			amount: 1000,
			paid: true
		});
		await mkAppointment(therapistId, clientId, { packId: pack!.id });

		await completePackIfExhausted(pack!.id);
		expect(await getActivePackForClient(clientId)).toBeNull();
	});

	it('paying for a completed pack leaves it completed', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 1,
			amount: 1000,
			paid: false
		});
		await mkAppointment(therapistId, clientId, { packId: pack!.id });
		await completePackIfExhausted(pack!.id);

		const [purchase] = await purchaseRows(pack!.id);
		await setPaymentStatus(therapistId, purchase.id, 'paid');
		expect(await getActivePackForClient(clientId)).toBeNull();
		expect((await listPacksForTherapist(therapistId))[0].status).toBe('completed');
	});

	it('createPack refuses a second pack while the first still has credit', async () => {
		await createPack(therapistId, { clientId, sessionCount: 2, amount: 2000, paid: true });
		const second = await createPack(therapistId, {
			clientId,
			sessionCount: 2,
			amount: 2000,
			paid: true
		});

		expect(second).toMatchObject({ error: 'client_has_active_pack', remaining: 2 });
	});

	it('updatePack cannot set sessionCount below what is already consumed', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 3,
			amount: 3000,
			paid: true
		});
		await mkAppointment(therapistId, clientId, { packId: pack!.id });
		await mkAppointment(therapistId, clientId, {
			packId: pack!.id,
			startAt: new Date('2026-10-02T10:00:00Z'),
			endAt: new Date('2026-10-02T11:00:00Z')
		});

		expect(await updatePack(therapistId, pack!.id, { sessionCount: 1 })).toEqual({
			error: 'below_consumed'
		});
		expect(await updatePack(therapistId, pack!.id, { sessionCount: 5 })).toEqual({});
	});
});

describe('pack ownership and owed totals', () => {
	it('createPack refuses a client that belongs to another therapist', async () => {
		const other = await mkTherapist();
		const otherClient = await mkClient(other.id);

		const result = await createPack(therapistId, {
			clientId: otherClient.id,
			sessionCount: 3,
			amount: 3000,
			paid: true
		});
		expect(result).toEqual({ error: 'client_not_found' });
		expect(await getActivePackForClient(otherClient.id)).toBeNull();
	});

	it('createPack refuses a client that does not exist', async () => {
		const result = await createPack(therapistId, {
			clientId: 'no-such-client',
			sessionCount: 3,
			amount: 3000,
			paid: true
		});
		expect(result).toEqual({ error: 'client_not_found' });
	});

	it('allows a new pack once the previous one is used up', async () => {
		const first = await createPack(therapistId, {
			clientId,
			sessionCount: 1,
			amount: 1000,
			paid: true
		});
		await mkAppointment(therapistId, clientId, { packId: first.pack!.id });
		await completePackIfExhausted(first.pack!.id);

		const second = await createPack(therapistId, {
			clientId,
			sessionCount: 5,
			amount: 4500,
			paid: true
		});
		expect(second.pack).toMatchObject({ status: 'active', sessionCount: 5 });
	});

	it('an unpaid pack shows in the balance list and the client totals', async () => {
		await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: false });

		expect(await listOutstandingBalancesByClient(therapistId)).toEqual([
			{ key: clientId, clientId, name: 'Test Client', owed: 4000 }
		]);
		expect((await getClientPaymentTotals(therapistId, clientId)).owed).toBe(4000);
	});

	it('a paid pack is not in the balance list', async () => {
		await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: true });

		expect(await listOutstandingBalancesByClient(therapistId)).toEqual([]);
		expect((await getClientPaymentTotals(therapistId, clientId)).owed).toBe(0);
	});

	it('a used-up pack that was never paid for is still owed', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 1,
			amount: 900,
			paid: false
		});
		await mkAppointment(therapistId, clientId, { packId: pack!.id });
		await completePackIfExhausted(pack!.id);

		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(true);
		expect((await getClientPaymentTotals(therapistId, clientId)).owed).toBe(900);
	});

	it('a cancelled unpaid pack is not owed: its unpaid purchase row goes with it', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 4,
			amount: 4000,
			paid: false
		});
		await cancelPack(therapistId, pack!.id);

		expect(await purchaseRows(pack!.id)).toEqual([]);
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(false);
		expect(await listOutstandingBalancesByClient(therapistId)).toEqual([]);
		expect((await getClientPaymentTotals(therapistId, clientId)).owed).toBe(0);
	});

	it('cancelling a paid pack keeps its purchase row as the record of the payment', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 4,
			amount: 4000,
			paid: true
		});
		await cancelPack(therapistId, pack!.id);

		const rows = await purchaseRows(pack!.id);
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe('paid');
	});

	it('cancelling leaves an unpaid purchase row with a Razorpay order in flight', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 4,
			amount: 4000,
			paid: false
		});
		const [purchase] = await purchaseRows(pack!.id);
		await db
			.update(payment)
			.set({ razorpayOrderId: 'order_test_1' })
			.where(eq(payment.id, purchase.id));

		await cancelPack(therapistId, pack!.id);
		expect(await purchaseRows(pack!.id)).toHaveLength(1);
	});

	it('cancelPack does nothing to another therapist’s pack', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 4,
			amount: 4000,
			paid: false
		});
		const other = await mkTherapist();

		await cancelPack(other.id, pack!.id);
		expect(await getActivePackForClient(clientId)).toMatchObject({ id: pack!.id });
		expect(await purchaseRows(pack!.id)).toHaveLength(1);
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(true);
	});

	it('pack money and charges add up together per client', async () => {
		await addCharge(therapistId, { clientId, amount: 1000 });
		await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: false });

		const rows = await listOutstandingBalancesByClient(therapistId);
		expect(rows).toEqual([{ key: clientId, clientId, name: 'Test Client', owed: 5000 }]);
	});

	it('listPacksForTherapist reports remaining sessions per pack', async () => {
		const { pack } = await createPack(therapistId, {
			clientId,
			sessionCount: 3,
			amount: 3000,
			paid: true
		});
		await mkAppointment(therapistId, clientId, { packId: pack!.id });

		const packs = await listPacksForTherapist(therapistId);
		expect(packs).toHaveLength(1);
		expect(packs[0]).toMatchObject({
			id: pack!.id,
			clientName: 'Test Client',
			sessionCount: 3,
			remaining: 2,
			status: 'active'
		});
	});

	it('listPacksForTherapist only lists this therapist’s packs', async () => {
		const other = await mkTherapist();
		const otherClient = await mkClient(other.id);
		await createPack(other.id, {
			clientId: otherClient.id,
			sessionCount: 2,
			amount: 2000,
			paid: true
		});

		expect(await listPacksForTherapist(therapistId)).toEqual([]);
	});
});
