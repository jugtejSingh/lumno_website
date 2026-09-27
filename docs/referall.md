# Referral — "you both get a month free"

Status: plan only, nothing built.

## The rule

At checkout (`/pricing` → `POST /subscribe`) a therapist can type the email of the
existing therapist who referred them.

- **Referee** (the person buying): first month free. Card/UPI mandate still collected up front.
- **Referrer** (the email they typed): one month free, granted once the referee's
  first real charge succeeds (after the free month).

## How Razorpay does each half

### Referee — `start_at` on the subscription

`subscriptions.create` takes `start_at` (unix seconds). Set it to now + 30 days.

- Checkout still runs. Razorpay does a small authentication transaction (auto-refunded)
  and sets up the card/UPI mandate. **That's how we get their card without charging them.**
- The sub goes `created → authenticated` now, then `active` + first `subscription.charged` on `start_at`.
- `expire_by` (30 min) is unaffected. It only limits how long the checkout link lives.

Code change: `createSubscription(planNumber, notes, startAt?)` in `src/lib/server/razorpay.ts`
passes `start_at` when set, and adds `notes.referral = '1'`.

**Webhook gap:** `ACTIVE_EVENTS` in `src/routes/webhooks/razorpay/+server.ts` is only
`subscription.activated` and `subscription.charged`. A deferred-start sub sits in
`authenticated` for the whole free month, so the referee would get no access.
Fix: treat `subscription.authenticated` as active **only when `notes.referral === '1'`**.
Normal subs keep ignoring it, so nobody gets access before a charge that could still fail.

### Referrer — refund their next charge

Razorpay has no "skip one cycle" on a live subscription. Offers only attach at create time,
`pause`/`resume` can't be scheduled and would flip our `status`, and you can't add a negative addon.

So: when the referrer's next `subscription.charged` arrives and they have a credit owed,
call `payments.refund(paymentId)` for the full amount and use up one credit.
Net effect: that month cost them nothing. It reuses the existing webhook path and needs no new cron.

- Cost: Razorpay keeps its gateway fee (~2% + GST) on refunded payments. We eat that.
- The refund shows on their statement 5–7 days later. The settings page should say
  "this month's charge will be refunded (referral)" so nobody gets a surprise.
- **Referrer on the free plan (no live sub):** not eligible. `checkReferralEligibility`
  (checkout time) and `settleReferralOnActivation` (activation time) both require the
  referrer's subscription to be `active` on plan 1 or 2 *right now*, rejecting with
  `referrer_not_paid` otherwise. There's no deferred-start fallback for a free-plan referrer.

## Schema (edit only — user runs `db:push`)

One new table in `billing.schema.ts`:

```ts
export const referral = pgTable('referral', {
	id: text('id').primaryKey().$defaultFn(() => randomUUID()),
	// unique: a therapist can only ever refer once, lifetime
	referrerTherapistId: text('referrer_therapist_id').notNull().unique().references(() => therapist.id, { onDelete: 'cascade' }),
	// unique: a therapist can only ever be referred once
	refereeTherapistId: text('referee_therapist_id').notNull().unique().references(() => therapist.id, { onDelete: 'cascade' }),
	// set when the referee's first real charge lands, which is when the referrer earns the month
	qualifiedAt: timestamp('qualified_at'),
	// set when the referrer's month is used up (refund issued, or deferred start given)
	redeemedAt: timestamp('redeemed_at'),
	redeemedPaymentId: text('redeemed_payment_id'), // the refunded Razorpay payment, for audit
	createdAt: timestamp('created_at').defaultNow().notNull()
});
```

"Credits owed to X" = `referrerTherapistId = X and qualifiedAt is not null and redeemedAt is null`.
No counter column to drift.

## Flow

1. **Checkout** (`POST /subscribe`, new-sub branch only, not plan change): body gets an optional `referrerEmail`.
   - Look up `user.email` → therapist. Reject with a 422 if not found, if it's the buyer, if
     the buyer has ever had a `razorpaySubscriptionId` (so it's first subscriptions only), or if
     the referrer has already referred someone before (their lifetime cap is spent).
   - Insert `referral` (the unique referrer column blocks a second referral **by** them, the unique
     referee column blocks a second referral **of** them).
   - Create the sub with `start_at = now + 30d`.
2. **`subscription.authenticated`** with `notes.referral`: grant access (status `active`).
3. **Referee's first `subscription.charged`**: set `qualifiedAt` on their referral row.
   Hook this in next to `handleWebhookEvent`, in the same transaction.
4. **Referrer's `subscription.charged`**: if they have a qualified, unredeemed row, claim it
   with `update ... set redeemed_at = now() where id = ? and redeemed_at is null returning`, then refund.
   The claim runs before the refund so a replayed webhook can't refund twice. If the refund
   call fails, log it to `razorpay_reconcile_exception` rather than un-claiming.

## Abuse limits (the cheap ones)

- Referee must be on their first ever subscription (checked in step 1).
- Referrer only earns after the referee actually pays once. Someone who signs up, takes the
  free month and cancels earns the referrer nothing.
- **Lifetime cap of 1 on both sides**, enforced by the `referral` table's own unique columns
  (no count query needed): a therapist can be referred at most once (`refereeTherapistId` unique)
  and can refer at most once (`referrerTherapistId` unique). So the most any single person can
  ever get from this system is **2 free months** — one as a referee, one as a referrer.
- Skipped: same-card/device fingerprinting. Add it if self-referral shows up in practice.

## Touch list

> **Naming collision:** `server/referrals.ts` and `tests/integration/referrals.test.ts`
> already exist, for an unrelated, shipped feature (the "refer clients to colleagues"
> directory — `listReferralTherapists`, `getReferralProfile`). The new billing-credit
> module below is named `billingReferrals.ts` / `billingReferrals.test.ts` instead.

| File | Change |
|---|---|
| `db/billing.schema.ts` | `referral` table (fits existing style, alongside `subscription`/`razorpayEvent`) |
| `server/razorpay.ts` | widen `createSubscription`'s `notes` param + add `start_at`; add `refundPayment(id)` (model on `cancelSubscription`) |
| `server/billingReferrals.ts` (new) | lookup referrer by email (join `therapist`→`user`, no existing helper), validate, create row, qualify, claim-and-refund |
| `routes/(app)/subscribe/+server.ts` | accept `referrerEmail` in body; `start_at` path in `createOrReusePendingSub`'s new-sub branch (not `changePlan`) |
| `routes/webhooks/razorpay/+server.ts` + `server/billing.ts` | `authenticated`-when-referral bucket; qualify + claim-and-refund branch keyed off `event === 'subscription.charged'` specifically, hung off `handleWebhookEvent`'s existing transaction |
| `routes/pricing/+page.svelte` | no `<form>` today — checkout is JS-driven (`choosePlan(tier)` posts JSON); add `referrerEmail` state + input, thread into the POST body |
| `routes/(app)/settings/+page.server.ts` + `+page.svelte` | add credit lookup into the existing `Promise.all` (alongside `getReferralProfile`, `getOrCreateSubscription`); render "this charge will be refunded" copy |
| `tests/integration/billingReferrals.test.ts` (new) | validation rules, qualify, single-refund claim — fake `WebhookEventInput` + call `handleWebhookEvent` directly, per `billing.test.ts` convention |
| `tests/integration/helpers.ts` | add `'referral'` to the `resetDb()` `TABLES` truncation list |

## Dependency-ordered build hierarchy

Tests-first: the test file for each unit is written and left red *before* that unit's
implementation, so the tests describe the intended behaviour rather than the code that
happens to exist. Work top to bottom — each step only needs the ones above it.

1. **Schema** — `db/billing.schema.ts`: add the `referral` table. (Edit only; user runs `db:push`.)
2. **Test plumbing** — `tests/integration/helpers.ts`: add `'referral'` to `TABLES` so `resetDb()` doesn't leave stale rows across tests. Depends on 1.
3. **Tests (red)** — `tests/integration/billingReferrals.test.ts` (new): every case up front —
   referrer-by-email lookup, reject self-referral, reject if buyer already subscribed once,
   reject if referrer's lifetime slot is spent, `start_at`/`notes.referral` on create,
   `authenticated`-counts-as-active for referral subs, qualify on referee's first `charged`,
   claim-then-refund on referrer's `charged`, replay can't double-refund. Written against the
   step-4/5 function signatures decided now, before either is implemented. Depends on 1, 2.
4. **Razorpay client** — `server/razorpay.ts`: widen `createSubscription`'s `notes` type to allow `referral`, add optional `start_at` param; add `refundPayment(paymentId)`. Implemented to make the relevant step-3 cases pass.
5. **Referral module** — `server/billingReferrals.ts` (new): referrer-by-email lookup (join `therapist`→`user`), create-row validation, qualify-on-charge, claim-and-refund. Depends on 1 (table) and 4 (`refundPayment`). Implemented to make the relevant step-3 cases pass.
6. **Webhook wiring** — `server/billing.ts` (`handleWebhookEvent`) + `routes/webhooks/razorpay/+server.ts`: treat `subscription.authenticated` as active when `notes.referral === '1'`; after the existing transaction, branch on `event === 'subscription.charged'` to call the qualify/claim-and-refund functions from step 5. Depends on 5.
7. **Checkout route** — `routes/(app)/subscribe/+server.ts`: accept `referrerEmail`, call the step-5 validate/create, pass `start_at`/`notes.referral` into `createSubscription` on the new-sub branch. Depends on 4 and 5.
8. **Pricing UI** — `routes/pricing/+page.svelte`: add the "Referred by (email)" input and thread it into `choosePlan`'s POST body. Depends on 7 (the field the route now accepts).
9. **Settings UI** — `routes/(app)/settings/+page.server.ts` + `+page.svelte`: surface credits owed / "this month's charge will be refunded". Depends on 5 (needs a read helper for a referrer's unredeemed, qualified row).

## Open questions

- Plan changes (cancel + create new sub): should a waiting credit give a deferred start there too? Default: no.
- Does the referee's email need to be verified before the referral counts? Default: yes, reuse `emailVerified`.
