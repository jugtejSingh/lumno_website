import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { subscription, razorpayEvent, client } from '$lib/server/db/schema';

// Sentinel held in pending_sub_id while our own createSubscription() call to
// Razorpay is in flight (before we have a real sub id to store). A slot stuck
// on this sentinel longer than STALE_SECONDS is treated as abandoned (crashed
// request) and can be reclaimed. Matches edvion's payment_service.py.
export const CREATING_SENTINEL = '__creating__';
export const STALE_SECONDS = 60;

// Plan numbers stored in subscription.plan:
//   0/1/2   -> a therapist's own plan (0 = free)
//   100/101/102 -> an organization's plan (see organizations.ts) — not wired
//                  into getEffectivePlan below; organizations are disabled.

export type TherapistTier = 0 | 1 | 2;

// Display name for a raw subscription.plan value — used wherever the UI shows
// the therapist's plan (settings, pricing), including the past_due/cancelled
// cases where plan is intentionally NOT what getEffectivePlan would return
// (see the plan-retention comment on the webhook handler).
export const TIER_NAMES: Record<TherapistTier, string> = { 0: 'Free', 1: 'Basic', 2: 'Pro' };

// The single source of truth for what each therapist tier allows. Add a usage by
// giving it a key here; guards read it via usageLimit(therapistId, 'key').
// Use Infinity for "allowed, no cap". A missing key means not allowed.
export const THERAPIST_PLAN_USAGE: Record<TherapistTier, Record<string, number>> = {
	0: { clients: 5, appointmentsPerMonth: 40 },
	1: { clients: 50, appointmentsPerMonth: 400 },
	2: { clients: Infinity, appointmentsPerMonth: Infinity }
};

// Every therapist has exactly one subscription row (edvion model — free is a
// real row with plan 0, not "no row"). Created lazily here on first touch
// rather than at each of the 3 signup call sites. Returns the full row —
// getEffectivePlan only reads plan/status, but /subscribe needs the rest
// (pending slot, live sub id, cancel_scheduled) too, so one shape covers both.
export async function getOrCreateSubscription(
	therapistId: string
): Promise<typeof subscription.$inferSelect> {
	const [existing] = await db
		.select()
		.from(subscription)
		.where(eq(subscription.therapistId, therapistId));
	if (existing) {
		return existing;
	}

	// Not found — this therapist's first touch. onConflictDoNothing covers the
	// race where a concurrent call inserted between our select and this insert;
	// re-select in that case to get the row the other call created.
	const [inserted] = await db
		.insert(subscription)
		.values({ therapistId })
		.onConflictDoNothing({ target: subscription.therapistId })
		.returning();
	if (inserted) {
		return inserted;
	}

	const [afterConflict] = await db
		.select()
		.from(subscription)
		.where(eq(subscription.therapistId, therapistId));
	return afterConflict;
}

// Atomically grab the pending-subscription slot for this therapist. One
// statement, whose row lock is the whole mutual exclusion — no held
// transaction across the Razorpay call. `seen` is the pending_sub_id the
// caller read (null, or a real sub id it intends to supersede); never pass
// the sentinel as `seen`. Returns true if we own the slot now.
// Matches edvion's claim_pending, minus the upsert half — our caller always
// goes through getOrCreateSubscription first, so the row already exists.
export async function claimPendingSlot(therapistId: string, seen: string | null): Promise<boolean> {
	// eq(x, null) is never true in SQL (NULL comparisons are UNKNOWN) — the
	// isNull() branch below is what covers the seen === null case, so only add
	// the eq() branch when seen is an actual id.
	const slotFree = seen === null
		? isNull(subscription.pendingSubId)
		: or(isNull(subscription.pendingSubId), eq(subscription.pendingSubId, seen));

	const [claimed] = await db
		.update(subscription)
		.set({ pendingSubId: CREATING_SENTINEL, pendingSince: new Date() })
		.where(
			and(
				eq(subscription.therapistId, therapistId),
				or(slotFree, lt(subscription.pendingSince, sql`now() - interval '${sql.raw(String(STALE_SECONDS))} seconds'`))
			)
		)
		.returning({ id: subscription.id });
	return claimed !== undefined;
}

// Write the real created-subscription id into the slot we hold, replacing the
// sentinel. Matches edvion's finalize_pending.
export async function finalizePendingSlot(therapistId: string, subId: string, planId: string): Promise<void> {
	await db
		.update(subscription)
		.set({ pendingSubId: subId, pendingPlanId: planId, pendingSince: new Date() })
		.where(eq(subscription.therapistId, therapistId));
}

// Release the slot, but only if it still holds `expected` (CAS — don't stomp
// a slot a concurrent request has since re-claimed). Matches edvion's
// clear_pending.
export async function clearPendingSlot(therapistId: string, expected: string): Promise<void> {
	await db
		.update(subscription)
		.set({ pendingSubId: null, pendingPlanId: null, pendingSince: null })
		.where(and(eq(subscription.therapistId, therapistId), eq(subscription.pendingSubId, expected)));
}

// Mark the subscription as pending cancellation without touching status —
// access continues until the period-end webhook. Idempotent.
export async function setCancelScheduled(therapistId: string): Promise<void> {
	await db
		.update(subscription)
		.set({ cancelScheduled: true })
		.where(eq(subscription.therapistId, therapistId));
}

export type WebhookEventInput = {
	signature: string;
	therapistId: string;
	plan: number;
	status: string;
	razorpaySubscriptionId: string | null;
	razorpayCustomerId: string | null;
	currentEnd: Date | null;
	event: string;
	razorpayPlanId: string | null;
	razorpayPaymentId: string | null;
	amount: number | null;
	currency: string | null;
};

// Applies one webhook event to a subscription row, with edvion's two dedup
// layers: (1) signature is unique on razorpay_event — a replayed webhook
// inserts nothing and we stop immediately; (2) even a first-seen signature can
// be stale/out-of-order/for-a-retired-sub, so it's checked against the current
// row before writing. Returns processed=false when the event was a no-op;
// oldSubId is the previously-live sub the caller should cancel on Razorpay,
// set only when this event just promoted a pending sub to active.
// Matches edvion's handle_webhook_event.
export async function handleWebhookEvent(
	input: WebhookEventInput
): Promise<{ processed: boolean; oldSubId: string | null }> {
	return db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(razorpayEvent)
			.values({
				signature: input.signature,
				therapistId: input.therapistId,
				plan: input.plan,
				razorpayPlanId: input.razorpayPlanId,
				razorpaySubscriptionId: input.razorpaySubscriptionId,
				razorpayCustomerId: input.razorpayCustomerId,
				razorpayPaymentId: input.razorpayPaymentId,
				amount: input.amount,
				currency: input.currency,
				event: input.event
			})
			.onConflictDoNothing({ target: razorpayEvent.signature })
			.returning({ id: razorpayEvent.id });
		if (!inserted) {
			return { processed: false, oldSubId: null };
		}

		const [existing] = await tx
			.select({
				razorpaySubscriptionId: subscription.razorpaySubscriptionId,
				status: subscription.status,
				currentEnd: subscription.currentEnd,
				pendingSubId: subscription.pendingSubId
			})
			.from(subscription)
			.where(eq(subscription.therapistId, input.therapistId));

		let oldSubId: string | null = null;

		if (existing) {
			const sameSub = existing.razorpaySubscriptionId === input.razorpaySubscriptionId;

			if (sameSub) {
				if (existing.status === 'cancelled') {
					return { processed: false, oldSubId: null };
				}
				if (
					input.currentEnd !== null &&
					existing.currentEnd !== null &&
					input.currentEnd < existing.currentEnd
				) {
					return { processed: false, oldSubId: null };
				}
			} else if (input.razorpaySubscriptionId === existing.pendingSubId) {
				// The subscription we created and were waiting on.
				if (input.status === 'active') {
					// Promote at any tier — an intentional downgrade lands here too.
					// The caller cancels oldSubId on Razorpay once this commits.
					oldSubId = existing.razorpaySubscriptionId;
				} else {
					// Expired/cancelled before it ever authenticated — clear the slot,
					// leave the live sub untouched.
					await tx
						.update(subscription)
						.set({ pendingSubId: null, pendingPlanId: null, pendingSince: null })
						.where(eq(subscription.therapistId, input.therapistId));
					return { processed: false, oldSubId: null };
				}
			} else {
				// Neither the live sub nor the pending one — a late event for a
				// subscription we already retired. Applying it would revert the
				// therapist to a plan they already left.
				return { processed: false, oldSubId: null };
			}
		}

		await tx
			.insert(subscription)
			.values({
				therapistId: input.therapistId,
				plan: input.plan,
				status: input.status,
				razorpaySubscriptionId: input.razorpaySubscriptionId,
				razorpayCustomerId: input.razorpayCustomerId,
				razorpayPlanId: input.razorpayPlanId,
				currentEnd: input.currentEnd
			})
			.onConflictDoUpdate({
				target: subscription.therapistId,
				set: {
					plan: input.plan,
					status: input.status,
					razorpaySubscriptionId: input.razorpaySubscriptionId,
					razorpayCustomerId: input.razorpayCustomerId,
					razorpayPlanId: input.razorpayPlanId,
					currentEnd: input.currentEnd,
					pendingSubId: null,
					pendingPlanId: null,
					pendingSince: null,
					cancelScheduled: null
				}
			});

		return { processed: true, oldSubId };
	});
}

export type EffectivePlan = {
	tier: TherapistTier;
	source: 'free' | 'therapist';
};

// Resolve the therapist tier actually in effect. `status` is the only access
// gate — mirrors edvion's effective_tier, minus its 3-day current_period_end
// grace-period backstop (not needed here for now).
export async function getEffectivePlan(therapistId: string): Promise<EffectivePlan> {
	const { plan, status } = await getOrCreateSubscription(therapistId);
	if (status === 'active' && (plan === 1 || plan === 2)) {
		return { tier: plan, source: 'therapist' };
	}

	return { tier: 0, source: 'free' };
}

// Returns the cap for this usage on the therapist's effective tier.
// null means not allowed — either the tier doesn't include it, or the key is
// unknown. Callers treat null as "block".
export async function usageLimit(therapistId: string, usage: string): Promise<number | null> {
	const { tier } = await getEffectivePlan(therapistId);
	const limit = THERAPIST_PLAN_USAGE[tier][usage];
	if (limit === undefined) {
		return null;
	}
	return limit;
}

// Keeps client.deactivatedAt matched to the therapist's *new* plan cap: the
// oldest `limit` clients (by createdAt) are/become bookable, anyone past that
// gets deactivated — same rule on the way up as on the way down, so e.g.
// upgrading from free to a 25-client plan with 30 existing clients still
// leaves the newest 5 deactivated. Called synchronously from the webhook
// handler on every processed plan change (not lazily — an upgrade should
// unlock clients immediately, not on next page load).
export async function syncClientActivationForCap(therapistId: string): Promise<void> {
	const limit = await usageLimit(therapistId, 'clients');
	if (limit === null) {
		return; // unknown usage key — nothing to enforce
	}

	const rows = await db
		.select({ id: client.id })
		.from(client)
		.where(eq(client.therapistId, therapistId))
		.orderBy(client.createdAt);
	const keepIds = rows.slice(0, limit).map((row) => row.id); // slice(0, Infinity) = everyone, for Pro
	const dropIds = rows.slice(limit).map((row) => row.id);

	if (keepIds.length > 0) {
		await db.update(client).set({ deactivatedAt: null }).where(inArray(client.id, keepIds));
	}
	if (dropIds.length > 0) {
		await db.update(client).set({ deactivatedAt: new Date() }).where(inArray(client.id, dropIds));
	}
}
