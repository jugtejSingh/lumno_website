import { and, eq, isNull, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { referral, therapist, user } from '$lib/server/db/schema';
import { refundPayment } from '$lib/server/razorpay';
import { getOrCreateSubscription } from '$lib/server/billing';

// drizzle-orm wraps driver errors in a DrizzleQueryError whose real Postgres
// error (with .code) is on .cause — check both shapes, since which one shows
// up depends on the drizzle version.
function isUniqueViolation(err: unknown): boolean {
	if (err instanceof Error && 'code' in err && err.code === '23505') {
		return true;
	}
	const cause = err instanceof Error ? err.cause : undefined;
	return Boolean(cause instanceof Error && 'code' in cause && cause.code === '23505');
}

// "You both get a month free" — see docs/referall.md. This module owns the
// `referral` table: creating a row (already qualified) once the referee's
// subscription activates, and claiming/redeeming it (refund, or a
// deferred-start credit) on the referrer's side.

export async function findTherapistIdByEmail(email: string): Promise<string | null> {
	const [row] = await db
		.select({ id: therapist.id })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(user.email, email));
	return row?.id ?? null;
}

export type CreateReferralRejection =
	| 'referrer_not_found'
	| 'self_referral'
	| 'referrer_not_paid'
	| 'referrer_already_referred'
	| 'referee_already_referred';

export type CreateReferralResult =
	| { ok: true; referrerTherapistId: string }
	| { ok: false; reason: CreateReferralRejection };

// Validation only, no write — lets the caller decide deferStart/reject before
// touching Razorpay. Both sides of the referral are lifetime-unique, checked
// here as a precheck (nicer error than a raw constraint violation) and by the
// table's own unique indexes as the backstop (see settleReferralOnActivation).
export async function checkReferralEligibility(
	refereeTherapistId: string,
	referrerEmail: string
): Promise<CreateReferralResult> {
	const referrerTherapistId = await findTherapistIdByEmail(referrerEmail);
	if (!referrerTherapistId) {
		return { ok: false, reason: 'referrer_not_found' };
	}
	if (referrerTherapistId === refereeTherapistId) {
		return { ok: false, reason: 'self_referral' };
	}

	// Only a currently paying therapist can refer — their credit is always
	// resolved by refunding a future charge (see refundReferralCredit), never by
	// deferring the start of a first subscription they haven't made yet.
	const referrerSubscription = await getOrCreateSubscription(referrerTherapistId);
	const referrerIsPaid =
		referrerSubscription.status === 'active' &&
		(referrerSubscription.plan === 1 || referrerSubscription.plan === 2);
	if (!referrerIsPaid) {
		return { ok: false, reason: 'referrer_not_paid' };
	}

	const [[asReferrerBefore], [asRefereeBefore]] = await Promise.all([
		db.select({ id: referral.id }).from(referral).where(eq(referral.referrerTherapistId, referrerTherapistId)),
		db.select({ id: referral.id }).from(referral).where(eq(referral.refereeTherapistId, refereeTherapistId))
	]);
	if (asReferrerBefore) {
		return { ok: false, reason: 'referrer_already_referred' };
	}
	if (asRefereeBefore) {
		return { ok: false, reason: 'referee_already_referred' };
	}

	return { ok: true, referrerTherapistId };
}

// The write. Called from the webhook once the referee's deferred-start
// subscription actually activates (see docs/referall.md) — never from
// checkout — so an abandoned/failed checkout never burns a lifetime referral
// slot. Re-checks the referrer is still active/paid right now rather than
// trusting the checkout-time snapshot, since activation can land any time
// after checkout. Row is inserted already qualified: activation is what earns
// the referrer their month, there's no separate "first charge" step anymore.
// The insert is the backstop against a concurrent duplicate (e.g. two
// referees citing the same referrer before either activates), caught instead
// of thrown so a race just means no row for the loser rather than a 500.
export async function settleReferralOnActivation(
	referrerTherapistId: string,
	refereeTherapistId: string
): Promise<boolean> {
	const referrerSubscription = await getOrCreateSubscription(referrerTherapistId);
	const referrerIsPaid =
		referrerSubscription.status === 'active' &&
		(referrerSubscription.plan === 1 || referrerSubscription.plan === 2);
	if (!referrerIsPaid) {
		return false;
	}

	try {
		await db.insert(referral).values({ referrerTherapistId, refereeTherapistId, qualifiedAt: new Date() });
	} catch (err) {
		if (isUniqueViolation(err)) {
			return false;
		}
		throw err;
	}
	return true;
}

// Atomic claim (compare-and-swap on redeemedAt) so a replayed webhook, or a
// concurrent call, can never redeem the same credit twice. Returns the
// claimed row's id, or null if there was nothing to claim. The caller applies
// the actual redemption (refund, or a deferred start_at) *after* this
// succeeds — if that follow-up fails, the claim stands; log it for
// reconciliation rather than un-claiming (see docs/referall.md).
export async function claimReferralCredit(referrerTherapistId: string): Promise<string | null> {
	const [row] = await db
		.update(referral)
		.set({ redeemedAt: new Date() })
		.where(
			and(
				eq(referral.referrerTherapistId, referrerTherapistId),
				isNotNull(referral.qualifiedAt),
				isNull(referral.redeemedAt)
			)
		)
		.returning({ id: referral.id });
	return row?.id ?? null;
}

// Called on the referrer's `subscription.charged`: claim then refund. Returns
// whether a credit was actually redeemed this call.
export async function refundReferralCredit(
	referrerTherapistId: string,
	razorpayPaymentId: string
): Promise<boolean> {
	const claimedId = await claimReferralCredit(referrerTherapistId);
	if (!claimedId) {
		return false;
	}
	await refundPayment(razorpayPaymentId);
	await db.update(referral).set({ redeemedPaymentId: razorpayPaymentId }).where(eq(referral.id, claimedId));
	return true;
}

// For the settings page: "this month's charge will be refunded (referral)".
export async function hasUnclaimedCredit(referrerTherapistId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: referral.id })
		.from(referral)
		.where(
			and(
				eq(referral.referrerTherapistId, referrerTherapistId),
				isNotNull(referral.qualifiedAt),
				isNull(referral.redeemedAt)
			)
		);
	return row !== undefined;
}
