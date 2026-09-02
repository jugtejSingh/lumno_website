import { describe, it, expect, beforeEach } from 'vitest';
import {
	addCharge,
	setPaymentStatus,
	hasOutstandingBalance,
	createPack,
	markPackPaid,
	updatePack,
	getActivePackForClient,
	completePackIfExhausted,
	listOutstandingBalancesByClient,
	getClientPaymentTotals,
	getMonthlyPaymentSummary,
	listVisiblePaymentsForClient
} from '$lib/server/payments';
import { resetDb, mkTherapist, mkClient, mkAppointment, mkPack } from './helpers';

let therapistId: string;
let clientId: string;

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

	it('listOutstandingBalancesByClient sums unpaid charges + pending packs, per client', async () => {
		await addCharge(therapistId, { clientId, amount: 1000 });
		await mkPack(therapistId, clientId, { amount: 5000, status: 'pending_payment' });

		const rows = await listOutstandingBalancesByClient(therapistId);
		expect(rows).toEqual([{ clientId, name: 'Test Client', owed: 6000 }]);
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
		expect(await listVisiblePaymentsForClient(clientId)).toHaveLength(0);
	});

	it('shows an unpaid charge once the session is over', async () => {
		const past = await mkAppointment(therapistId, clientId, {
			startAt: new Date(Date.now() - 7_200_000),
			endAt: new Date(Date.now() - 3_600_000)
		});
		await addCharge(therapistId, { clientId, appointmentId: past.id, amount: 1000 });
		expect(await listVisiblePaymentsForClient(clientId)).toHaveLength(1);
	});
});

describe('packs', () => {
	it('createPack starts pending; markPackPaid makes it active and bookable', async () => {
		const pack = await createPack(therapistId, { clientId, sessionCount: 4, amount: 4000 });
		expect(pack.status).toBe('pending_payment');
		expect(await getActivePackForClient(clientId)).toBeNull();

		expect(await markPackPaid(therapistId, pack.id)).toEqual({});
		const active = await getActivePackForClient(clientId);
		expect(active).toMatchObject({ id: pack.id, remaining: 4 });
	});

	it('remaining decreases as appointments are booked against the pack', async () => {
		const pack = await createPack(therapistId, { clientId, sessionCount: 2, amount: 2000 });
		await markPackPaid(therapistId, pack.id);
		await mkAppointment(therapistId, clientId, { packId: pack.id });

		expect((await getActivePackForClient(clientId))!.remaining).toBe(1);
	});

	it('completePackIfExhausted flips the pack to completed at zero remaining', async () => {
		const pack = await createPack(therapistId, { clientId, sessionCount: 1, amount: 1000 });
		await markPackPaid(therapistId, pack.id);
		await mkAppointment(therapistId, clientId, { packId: pack.id });

		await completePackIfExhausted(pack.id);
		expect(await getActivePackForClient(clientId)).toBeNull();
	});

	it('markPackPaid refuses a second active pack for the same client', async () => {
		const first = await createPack(therapistId, { clientId, sessionCount: 2, amount: 2000 });
		await markPackPaid(therapistId, first.id);
		const second = await createPack(therapistId, { clientId, sessionCount: 2, amount: 2000 });

		expect(await markPackPaid(therapistId, second.id)).toMatchObject({
			error: 'client_has_active_pack'
		});
	});

	it('updatePack cannot set sessionCount below what is already consumed', async () => {
		const pack = await createPack(therapistId, { clientId, sessionCount: 3, amount: 3000 });
		await markPackPaid(therapistId, pack.id);
		await mkAppointment(therapistId, clientId, { packId: pack.id });
		await mkAppointment(therapistId, clientId, {
			packId: pack.id,
			startAt: new Date('2026-10-02T10:00:00Z'),
			endAt: new Date('2026-10-02T11:00:00Z')
		});

		expect(await updatePack(therapistId, pack.id, { sessionCount: 1 })).toEqual({
			error: 'below_consumed'
		});
		expect(await updatePack(therapistId, pack.id, { sessionCount: 5 })).toEqual({});
	});
});
