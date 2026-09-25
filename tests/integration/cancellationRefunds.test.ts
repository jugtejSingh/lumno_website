import { describe, it, expect, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { actions, load } from '../../src/routes/(app)/payments/+page.server';
import { GET as getHistory } from '../../src/routes/(app)/payments/clients/[clientId]/+server';
import { cancelAppointment } from '$lib/server/appointments';
import { addCharge, getBalanceDueForClient, listVisiblePaymentsForClient } from '$lib/server/payments';
import { resetDb, mkTherapist, mkClient, mkAppointment, mkPaymentSettings, mkEvent } from './helpers';

// Cancelling a session, checked only through what people see: the therapist's /payments
// page (refund banner, client history, Mark refunded) and the client's portal balance.
// Policy: free with 24h+ notice, 50% with 8–24h, 100% under 8h. Session rate ₹1000.

let therapist: Awaited<ReturnType<typeof mkTherapist>>;
let clientId: string;

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);
const WELL_BEFORE_ANY_WINDOW = 7 * 24;
const IN_50_PERCENT_WINDOW = 12;
const IN_100_PERCENT_WINDOW = 2;

type HistoryRow = { id: string; amount: number; status: string; refundDue: number | null; refundFlagId: string | null };

async function bookSession(hours: number, status: 'confirmed' | 'completed' = 'confirmed') {
	const startAt = hoursFromNow(hours);
	const a = await mkAppointment(therapist.id, clientId, {
		startAt,
		endAt: new Date(startAt.getTime() + 3_600_000),
		status
	});
	const charge = await addCharge(therapist.id, { clientId, appointmentId: a.id, amount: 1000 });
	return { appointmentId: a.id, chargeId: charge.id };
}

// the client paid, recorded the way the therapist does it: Mark paid on /payments
async function bookPaidSession(hours: number) {
	const session = await bookSession(hours);
	const result = await actions.markPaid(
		mkEvent({ locals: { therapistId: therapist.id }, fields: { paymentId: session.chargeId } }) as never
	);
	expect(isActionFailure(result)).toBe(false);
	return session;
}

async function refundBanner() {
	const event = mkEvent({ parent: async () => ({ therapist }) });
	const page = (await load(event as never)) as unknown as {
		doubleCharges: { id: string; kind: string; amount: number }[];
	};
	return page.doubleCharges;
}

async function clientHistory(): Promise<HistoryRow[]> {
	const event = mkEvent({
		locals: { therapistId: therapist.id },
		params: { clientId },
		url: 'http://localhost/payments/clients/x?page=1'
	});
	const res = await getHistory(event as never);
	return (await res.json()).rows;
}

async function markRefunded(flagId: string) {
	return actions.dismissDoubleCharge(
		mkEvent({ locals: { therapistId: therapist.id }, fields: { exceptionId: flagId } }) as never
	);
}

beforeEach(async () => {
	await resetDb();
	therapist = await mkTherapist({ timezone: 'UTC' });
	clientId = (await mkClient(therapist.id, { rate: 1000 })).id;
	await mkPaymentSettings(therapist.id, { freeChangeWindowHours: 24, partialChangeWindowHours: 8 });
});

describe('refunds on a paid session', () => {
	it('client cancels well before any window: full ₹1000 refund', async () => {
		const { appointmentId } = await bookPaidSession(WELL_BEFORE_ANY_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);

		expect(await refundBanner()).toMatchObject([{ kind: 'cancel_refund', amount: 1000 }]);
		expect((await clientHistory())[0]).toMatchObject({ status: 'paid', amount: 1000, refundDue: 1000 });
	});

	it('therapist cancels, even last minute: full ₹1000 refund', async () => {
		const { appointmentId } = await bookPaidSession(IN_100_PERCENT_WINDOW);
		await cancelAppointment(therapist.id, appointmentId);

		expect(await refundBanner()).toMatchObject([{ amount: 1000 }]);
		expect((await clientHistory())[0].refundDue).toBe(1000);
	});

	it('client cancels in the 50% window: only ₹500 refunded, no extra fee billed', async () => {
		const { appointmentId } = await bookPaidSession(IN_50_PERCENT_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);

		expect(await refundBanner()).toMatchObject([{ amount: 500 }]);
		const history = await clientHistory();
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({ status: 'paid', amount: 1000, refundDue: 500 });
		expect(await getBalanceDueForClient(clientId)).toBe(0);
	});

	it('client cancels in the 100% window: no refund, nothing extra billed', async () => {
		const { appointmentId } = await bookPaidSession(IN_100_PERCENT_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);

		expect(await refundBanner()).toHaveLength(0);
		const history = await clientHistory();
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({ status: 'paid', amount: 1000, refundDue: null });
	});

	it('Mark refunded clears it from the banner and the client history', async () => {
		const { appointmentId } = await bookPaidSession(WELL_BEFORE_ANY_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);
		const [flag] = await refundBanner();

		expect(isActionFailure(await markRefunded(flag.id))).toBe(false);

		expect(await refundBanner()).toHaveLength(0);
		expect((await clientHistory())[0]).toMatchObject({ refundDue: null, refundFlagId: null });
	});

	it('the client sees the refund pending, then refunded, and owes nothing throughout', async () => {
		const { appointmentId } = await bookPaidSession(IN_50_PERCENT_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);

		const pending = await listVisiblePaymentsForClient(clientId, 1, 10);
		expect(pending.total).toBe(1);
		expect(pending.rows[0]).toMatchObject({ status: 'paid', amount: 1000, refundDue: 500, refundedAt: null });
		expect(await getBalanceDueForClient(clientId)).toBe(0);

		const [flag] = await refundBanner();
		await markRefunded(flag.id);

		const refunded = await listVisiblePaymentsForClient(clientId, 1, 10);
		expect(refunded.rows[0]).toMatchObject({ refundDue: 500 });
		expect(refunded.rows[0].refundedAt).toBeInstanceOf(Date);
		expect(await getBalanceDueForClient(clientId)).toBe(0);
	});

	it('a paid session with no refund owed stays out of the client list', async () => {
		const { appointmentId } = await bookPaidSession(IN_100_PERCENT_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);

		expect((await listVisiblePaymentsForClient(clientId, 1, 10)).total).toBe(0);
	});

	it("another therapist can't mark it refunded", async () => {
		const { appointmentId } = await bookPaidSession(WELL_BEFORE_ANY_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);
		const [flag] = await refundBanner();
		const other = await mkTherapist();

		const result = await actions.dismissDoubleCharge(
			mkEvent({ locals: { therapistId: other.id }, fields: { exceptionId: flag.id } }) as never
		);
		expect(isActionFailure(result)).toBe(true);
		expect(await refundBanner()).toHaveLength(1);
	});
});

describe('fees on an unpaid session', () => {
	it('client cancels well before any window: owes nothing, no refund', async () => {
		const { appointmentId } = await bookSession(WELL_BEFORE_ANY_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);

		expect(await clientHistory()).toHaveLength(0);
		expect(await refundBanner()).toHaveLength(0);
	});

	it('client cancels in the 50% window: owes ₹500 with a note saying when and who, and sees it in the portal', async () => {
		const { appointmentId } = await bookSession(IN_50_PERCENT_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);

		const history = await clientHistory();
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({ status: 'unpaid', amount: 500 });
		expect((history[0] as HistoryRow & { note: string }).note).toMatch(
			/^Late cancellation fee \(50%\) · .+ session · cancelled .+ by client$/
		);

		const portal = await listVisiblePaymentsForClient(clientId, 1, 10);
		expect(portal.rows).toMatchObject([{ amount: 500 }]);
		expect(await getBalanceDueForClient(clientId)).toBe(500);
		expect(await refundBanner()).toHaveLength(0);
	});

	it('client cancels in the 100% window: owes the full ₹1000 once, not twice', async () => {
		const { appointmentId } = await bookSession(IN_100_PERCENT_WINDOW);
		await cancelAppointment(therapist.id, appointmentId, clientId);

		const history = await clientHistory();
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({ status: 'unpaid', amount: 1000 });
		expect(await getBalanceDueForClient(clientId)).toBe(1000);
	});

	it('an upcoming session that is not cancelled stays hidden from the client until it happens', async () => {
		await bookSession(IN_50_PERCENT_WINDOW);

		expect((await listVisiblePaymentsForClient(clientId, 1, 10)).total).toBe(0);
		expect(await getBalanceDueForClient(clientId)).toBe(0);
	});

	it('therapist cancels: the note says so', async () => {
		// a session that already happened — the therapist picks the fee (here 50%)
		const { appointmentId } = await bookSession(-48, 'completed');
		await cancelAppointment(therapist.id, appointmentId, undefined, 'partial');

		const history = await clientHistory();
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({ amount: 500 });
		expect((history[0] as HistoryRow & { note: string }).note).toMatch(/by therapist$/);
	});
});
