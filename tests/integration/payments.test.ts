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
	getMonthlyPaymentSummary,
	listVisiblePaymentsForClient,
	getBalanceDueForClient
} from '$lib/server/payments';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { payment } from '$lib/server/db/schema';
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

	it('getMonthlyPaymentSummary buckets by created month', async () => {
		await addCharge(therapistId, { clientId, amount: 1000 });
		const now = new Date();
		const summary = await getMonthlyPaymentSummary(therapistId, now.getUTCFullYear(), now.getUTCMonth());
		expect(summary).toEqual({ paid: 0, unpaid: 1000, total: 1000 });
	});
});

describe('client-visible payments', () => {
	it('hides an unpaid charge for a session that has not happened yet', async () => {
		const future = await mkAppointment(therapistId, clientId, {
			startAt: new Date(Date.now() + 86_400_000),
			endAt: new Date(Date.now() + 86_400_000 + 3_600_000)
		});
		await addCharge(therapistId, { clientId, appointmentId: future.id, amount: 1000 });
		expect((await listVisiblePaymentsForClient(clientId, 1, 5)).rows).toHaveLength(0);
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
		const result = await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: false });
		const pack = result.pack!;
		expect(pack.status).toBe('active');
		expect(await getActivePackForClient(clientId)).toMatchObject({ id: pack.id, remaining: 4 });
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(true);

		const [purchase] = await purchaseRows(pack.id);
		await setPaymentStatus(therapistId, purchase.id, 'paid');
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(false);
	});

	it('createPack writes one purchase row carrying the price, not tied to any session', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: false });

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
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 1, amount: 1000, paid: true });

		const [purchase] = await purchaseRows(pack!.id);
		expect(purchase.status).toBe('paid');
		expect(purchase.paidAt).not.toBeNull();
		expect(purchase.note).toBe('Pack: 1 session');
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(false);
	});

	it('remaining decreases as appointments are booked against the pack', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 2, amount: 2000, paid: true });
		await mkAppointment(therapistId, clientId, { packId: pack!.id });

		expect((await getActivePackForClient(clientId))!.remaining).toBe(1);
	});

	it('completePackIfExhausted flips the pack to completed at zero remaining', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 1, amount: 1000, paid: true });
		await mkAppointment(therapistId, clientId, { packId: pack!.id });

		await completePackIfExhausted(pack!.id);
		expect(await getActivePackForClient(clientId)).toBeNull();
	});

	it('paying for a completed pack leaves it completed', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 1, amount: 1000, paid: false });
		await mkAppointment(therapistId, clientId, { packId: pack!.id });
		await completePackIfExhausted(pack!.id);

		const [purchase] = await purchaseRows(pack!.id);
		await setPaymentStatus(therapistId, purchase.id, 'paid');
		expect(await getActivePackForClient(clientId)).toBeNull();
		expect((await listPacksForTherapist(therapistId))[0].status).toBe('completed');
	});

	it('createPack refuses a second pack while the first still has credit', async () => {
		await createPack(therapistId, { clientId, sessionCount: 2, amount: 2000, paid: true });
		const second = await createPack(therapistId, { clientId, sessionCount: 2, amount: 2000, paid: true });

		expect(second).toMatchObject({ error: 'client_has_active_pack', remaining: 2 });
	});

	it('updatePack cannot set sessionCount below what is already consumed', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 3, amount: 3000, paid: true });
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
		const first = await createPack(therapistId, { clientId, sessionCount: 1, amount: 1000, paid: true });
		await mkAppointment(therapistId, clientId, { packId: first.pack!.id });
		await completePackIfExhausted(first.pack!.id);

		const second = await createPack(therapistId, { clientId, sessionCount: 5, amount: 4500, paid: true });
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
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 1, amount: 900, paid: false });
		await mkAppointment(therapistId, clientId, { packId: pack!.id });
		await completePackIfExhausted(pack!.id);

		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(true);
		expect((await getClientPaymentTotals(therapistId, clientId)).owed).toBe(900);
	});

	it('a cancelled unpaid pack is not owed: its unpaid purchase row goes with it', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: false });
		await cancelPack(therapistId, pack!.id);

		expect(await purchaseRows(pack!.id)).toEqual([]);
		expect(await hasOutstandingBalance(therapistId, clientId)).toBe(false);
		expect(await listOutstandingBalancesByClient(therapistId)).toEqual([]);
		expect((await getClientPaymentTotals(therapistId, clientId)).owed).toBe(0);
	});

	it('cancelling a paid pack keeps its purchase row as the record of the payment', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: true });
		await cancelPack(therapistId, pack!.id);

		const rows = await purchaseRows(pack!.id);
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe('paid');
	});

	it('cancelling leaves an unpaid purchase row with a Razorpay order in flight', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: false });
		const [purchase] = await purchaseRows(pack!.id);
		await db.update(payment).set({ razorpayOrderId: 'order_test_1' }).where(eq(payment.id, purchase.id));

		await cancelPack(therapistId, pack!.id);
		expect(await purchaseRows(pack!.id)).toHaveLength(1);
	});

	it('cancelPack does nothing to another therapist’s pack', async () => {
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000, paid: false });
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
		const { pack } = await createPack(therapistId, { clientId, sessionCount: 3, amount: 3000, paid: true });
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
		await createPack(other.id, { clientId: otherClient.id, sessionCount: 2, amount: 2000, paid: true });

		expect(await listPacksForTherapist(therapistId)).toEqual([]);
	});
});
