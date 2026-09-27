import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { referral } from '$lib/server/db/schema';
import { resetDb, mkTherapist, mkReferral, mkSubscription } from './helpers';

// refundReferralCredit calls out to Razorpay — stub the network call, keep
// everything else in razorpay.ts real (same pattern as razorpayConnection.test.ts).
const refundPaymentMock = vi.fn();
vi.mock('$lib/server/razorpay', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/razorpay')>();
	return { ...actual, refundPayment: refundPaymentMock };
});

const {
	findTherapistIdByEmail,
	checkReferralEligibility,
	settleReferralOnActivation,
	claimReferralCredit,
	refundReferralCredit,
	hasUnclaimedCredit
} = await import('$lib/server/billingReferrals');

beforeEach(() => {
	refundPaymentMock.mockReset();
	return resetDb();
});

describe('findTherapistIdByEmail', () => {
	it('resolves a therapist by their user email', async () => {
		const t = await mkTherapist();
		expect(await findTherapistIdByEmail(t.user.email)).toBe(t.id);
	});

	it('returns null for an unknown email', async () => {
		expect(await findTherapistIdByEmail('nobody@example.com')).toBeNull();
	});
});

describe('checkReferralEligibility', () => {
	it('accepts a referee/referrer pair with no write', async () => {
		const referrer = await mkTherapist();
		await mkSubscription({ therapistId: referrer.id });
		const referee = await mkTherapist();
		const result = await checkReferralEligibility(referee.id, referrer.user.email);
		expect(result).toEqual({ ok: true, referrerTherapistId: referrer.id });

		const [row] = await db.select().from(referral).where(eq(referral.refereeTherapistId, referee.id));
		expect(row).toBeUndefined();
	});

	it('rejects when the referrer email is not a therapist', async () => {
		const referee = await mkTherapist();
		expect(await checkReferralEligibility(referee.id, 'nobody@example.com')).toEqual({
			ok: false,
			reason: 'referrer_not_found'
		});
	});

	it('rejects self-referral', async () => {
		const t = await mkTherapist();
		expect(await checkReferralEligibility(t.id, t.user.email)).toEqual({
			ok: false,
			reason: 'self_referral'
		});
	});

	it('rejects a referrer who is not on a paid plan', async () => {
		const referrer = await mkTherapist(); // default subscription row: plan 0, status active
		const referee = await mkTherapist();
		expect(await checkReferralEligibility(referee.id, referrer.user.email)).toEqual({
			ok: false,
			reason: 'referrer_not_paid'
		});
	});

	it('rejects a referrer whose paid subscription is not active (e.g. past_due)', async () => {
		const referrer = await mkTherapist();
		await mkSubscription({ therapistId: referrer.id, plan: 1, status: 'past_due' });
		const referee = await mkTherapist();
		expect(await checkReferralEligibility(referee.id, referrer.user.email)).toEqual({
			ok: false,
			reason: 'referrer_not_paid'
		});
	});

	it('rejects a referrer who has already referred someone (lifetime cap of 1)', async () => {
		const referrer = await mkTherapist();
		await mkSubscription({ therapistId: referrer.id });
		const firstReferee = await mkTherapist();
		await mkReferral(referrer.id, firstReferee.id);

		const secondReferee = await mkTherapist();
		expect(await checkReferralEligibility(secondReferee.id, referrer.user.email)).toEqual({
			ok: false,
			reason: 'referrer_already_referred'
		});
	});

	it('rejects a referee who has already been referred (lifetime cap of 1)', async () => {
		const firstReferrer = await mkTherapist();
		const referee = await mkTherapist();
		await mkReferral(firstReferrer.id, referee.id);

		const secondReferrer = await mkTherapist();
		await mkSubscription({ therapistId: secondReferrer.id });
		expect(await checkReferralEligibility(referee.id, secondReferrer.user.email)).toEqual({
			ok: false,
			reason: 'referee_already_referred'
		});
	});
});

describe('settleReferralOnActivation', () => {
	it('creates an already-qualified row once the referee activates', async () => {
		const referrer = await mkTherapist();
		await mkSubscription({ therapistId: referrer.id });
		const referee = await mkTherapist();

		expect(await settleReferralOnActivation(referrer.id, referee.id)).toBe(true);

		const [row] = await db.select().from(referral).where(eq(referral.refereeTherapistId, referee.id));
		expect(row.referrerTherapistId).toBe(referrer.id);
		expect(row.qualifiedAt).not.toBeNull();
		expect(row.redeemedAt).toBeNull();
	});

	it('writes nothing when the referrer is no longer on a paid plan', async () => {
		const referrer = await mkTherapist(); // default subscription row: plan 0, status active
		const referee = await mkTherapist();

		expect(await settleReferralOnActivation(referrer.id, referee.id)).toBe(false);

		const [row] = await db.select().from(referral).where(eq(referral.refereeTherapistId, referee.id));
		expect(row).toBeUndefined();
	});

	it('is a no-op on a repeat call for the same referee (replayed webhook)', async () => {
		const referrer = await mkTherapist();
		await mkSubscription({ therapistId: referrer.id });
		const referee = await mkTherapist();

		expect(await settleReferralOnActivation(referrer.id, referee.id)).toBe(true);
		expect(await settleReferralOnActivation(referrer.id, referee.id)).toBe(false);

		const rows = await db.select().from(referral).where(eq(referral.refereeTherapistId, referee.id));
		expect(rows).toHaveLength(1);
	});

	it('a second concurrent-style call for the same referrer never creates two rows', async () => {
		const referrer = await mkTherapist();
		await mkSubscription({ therapistId: referrer.id });
		const firstReferee = await mkTherapist();
		const secondReferee = await mkTherapist();

		const [firstOk, secondOk] = await Promise.all([
			settleReferralOnActivation(referrer.id, firstReferee.id),
			settleReferralOnActivation(referrer.id, secondReferee.id)
		]);
		expect([firstOk, secondOk].filter(Boolean)).toHaveLength(1);

		const rows = await db.select().from(referral).where(eq(referral.referrerTherapistId, referrer.id));
		expect(rows).toHaveLength(1);
	});
});

describe('claimReferralCredit', () => {
	it('claims a qualified, unredeemed row and returns its id', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		const row = await mkReferral(referrer.id, referee.id, { qualifiedAt: new Date() });

		const claimedId = await claimReferralCredit(referrer.id);
		expect(claimedId).toBe(row.id);

		const [after] = await db.select().from(referral).where(eq(referral.id, row.id));
		expect(after.redeemedAt).not.toBeNull();
	});

	it('returns null when there is no qualified row', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		await mkReferral(referrer.id, referee.id); // qualifiedAt still null

		expect(await claimReferralCredit(referrer.id)).toBeNull();
	});

	it('returns null when the row is already redeemed', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		await mkReferral(referrer.id, referee.id, { qualifiedAt: new Date(), redeemedAt: new Date() });

		expect(await claimReferralCredit(referrer.id)).toBeNull();
	});

	it('a second concurrent-style call never claims the same row twice', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		await mkReferral(referrer.id, referee.id, { qualifiedAt: new Date() });

		const [firstClaim, secondClaim] = await Promise.all([
			claimReferralCredit(referrer.id),
			claimReferralCredit(referrer.id)
		]);
		const claims = [firstClaim, secondClaim].filter((id) => id !== null);
		expect(claims).toHaveLength(1);
	});
});

describe('refundReferralCredit', () => {
	it('claims the credit, refunds the payment, and records the payment id', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		const row = await mkReferral(referrer.id, referee.id, { qualifiedAt: new Date() });
		refundPaymentMock.mockResolvedValue({ id: 'rfnd_123' });

		expect(await refundReferralCredit(referrer.id, 'pay_abc')).toBe(true);
		expect(refundPaymentMock).toHaveBeenCalledWith('pay_abc');

		const [after] = await db.select().from(referral).where(eq(referral.id, row.id));
		expect(after.redeemedPaymentId).toBe('pay_abc');
	});

	it('does nothing and does not call Razorpay when there is no credit to refund', async () => {
		const referrer = await mkTherapist();
		expect(await refundReferralCredit(referrer.id, 'pay_abc')).toBe(false);
		expect(refundPaymentMock).not.toHaveBeenCalled();
	});

	it('a replayed webhook cannot refund the same credit twice', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		await mkReferral(referrer.id, referee.id, { qualifiedAt: new Date() });
		refundPaymentMock.mockResolvedValue({ id: 'rfnd_123' });

		expect(await refundReferralCredit(referrer.id, 'pay_abc')).toBe(true);
		expect(await refundReferralCredit(referrer.id, 'pay_replay')).toBe(false);
		expect(refundPaymentMock).toHaveBeenCalledTimes(1);
	});
});

describe('hasUnclaimedCredit', () => {
	it('is true once the referee has qualified and before redemption', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		await mkReferral(referrer.id, referee.id, { qualifiedAt: new Date() });
		expect(await hasUnclaimedCredit(referrer.id)).toBe(true);
	});

	it('is false before the referee has qualified', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		await mkReferral(referrer.id, referee.id);
		expect(await hasUnclaimedCredit(referrer.id)).toBe(false);
	});

	it('is false once redeemed', async () => {
		const referrer = await mkTherapist();
		const referee = await mkTherapist();
		await mkReferral(referrer.id, referee.id, { qualifiedAt: new Date(), redeemedAt: new Date() });
		expect(await hasUnclaimedCredit(referrer.id)).toBe(false);
	});
});
