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
- **Referrer on the free plan (no live sub):** the credit waits. On their next `/subscribe`,
  use it the same way as a referee: `start_at` = now + 30d, then decrement.

## Schema (edit only — user runs `db:push`)

One new table in `billing.schema.ts`:

```ts
export const referral = pgTable('referral', {
	id: text('id').primaryKey().$defaultFn(() => randomUUID()),
	referrerTherapistId: text('referrer_therapist_id').notNull().references(() => therapist.id, { onDelete: 'cascade' }),
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
   - Look up `user.email` → therapist. Reject with a 422 if not found, if it's the buyer, or if
     the buyer has ever had a `razorpaySubscriptionId` (so it's first subscriptions only).
   - Insert `referral` (the unique referee column blocks a second referral).
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
- Cap credits per referrer (e.g. 12 a year) with a count query at step 1.
- Skipped: same-card/device fingerprinting. Add it if self-referral shows up in practice.

## Touch list

| File | Change |
|---|---|
| `db/billing.schema.ts` | `referral` table |
| `server/razorpay.ts` | `start_at` + `notes.referral` on `createSubscription`; `refundPayment(id)` |
| `server/referrals.ts` (new) | lookup/validate referrer, create row, qualify, claim-and-refund |
| `routes/(app)/subscribe/+server.ts` | accept `referrerEmail`; free-plan-credit `start_at` path |
| `routes/webhooks/razorpay/+server.ts` | `authenticated`-when-referral; qualify + redeem on `charged` |
| `routes/pricing/+page.svelte` | optional "Referred by (email)" input |
| `routes/(app)/settings/+page.svelte` | show credits owed / "this charge will be refunded" |
| `tests/integration/referrals.test.ts` | validation rules, qualify, single-refund claim |

## Open questions

- Plan changes (cancel + create new sub): should a waiting credit give a deferred start there too? Default: no.
- Does the referee's email need to be verified before the referral counts? Default: yes, reuse `emailVerified`.
