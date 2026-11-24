# 2-month free trial (option A: mandate up front, first charge on day 60)

## Idea

Reuse the referral free-month path that's already in prod. Every **first-time**
subscriber's Razorpay subscription is created with `start_at = now + 60 days`.
Checkout still runs and collects the UPI/card mandate. The sub sits in
`authenticated` for 60 days (access granted), then Razorpay activates it and
charges automatically.

No schema change, no migration, no cron job.

## Who gets it

- First subscription only: the existing `!subscription.razorpaySubscriptionId`
  guard in `/subscribe` already excludes anyone who has ever subscribed
  (re-subscribers after cancel / past_due pay straight away).
- **Referral stacking (confirmed):** a referred therapist gets
  60 + 30 = 90 days. The referrer still earns their month exactly as today.

## Step 0: verify on Razorpay test mode first

- `start_at` 60 days out is accepted for the plans we use (UPI AutoPay + card).
- The mandate authorises fine with a 60-day gap before the first debit.
- What `cancel(id, true)` does to an `authenticated` sub that hasn't started
  (which webhook fires, and when).

If 60 days is rejected, stop here and rethink before writing code.

## Changes

1. **`src/routes/(app)/subscribe/+server.ts`**
   - Add `TRIAL_SECONDS = 60 * 24 * 60 * 60`.
   - First-time subscriber → always deferred start:
     `startAt = now + TRIAL_SECONDS (+ REFERRAL_FREE_MONTH_SECONDS if referral)`.
   - Notes get `trial: '1'` (referral notes unchanged).
   - The pending-sub reuse guard already refuses to reuse when `deferStart` is set.
   - **Plan change during trial:** if the current sub is still in trial
     (`currentEnd` in the future and no charge yet), the replacement sub is
     created with the **same** `start_at`, so switching plans doesn't end the
     trial early or charge immediately.

2. **`src/lib/server/razorpay.ts`**: widen the `createSubscription` notes type
   with `trial?: '1'`.

3. **`src/routes/webhooks/razorpay/+server.ts`**
   - Generalise `isReferralAuthenticated` → `isDeferredAuthenticated`:
     `subscription.authenticated` with `notes.trial === '1'` **or**
     `notes.referral === '1'` (keeps referral subs already in flight working).
   - Add `start_at` to the payload type. For a deferred authenticated event,
     store `start_at` as `currentEnd` (= trial end date), since `current_end`
     is null before activation.
   - Referral settlement still runs only when `notes.referral === '1'`.

4. **`src/lib/server/db/billing.schema.ts`**: comment only, `currentEnd` also
   holds the trial end while in trial. No column change.

5. **Settings page** (`+page.server.ts` / `+page.svelte`): while in trial show
   "Free trial, first charge on <currentEnd>" instead of the paid-cycle text.

6. **Pricing page** (`src/routes/pricing/+page.svelte`): "2 months free" copy
   on the plans, and update the referral paragraph (now "an extra free month").

7. **Tests** (`tests/integration/`): extend the existing referral tests:
   - first-time sub → created with ~60-day `start_at` + `trial` note
   - referral → ~90 days
   - re-subscriber → no `start_at`
   - webhook `authenticated` + `trial` note → status active, `currentEnd` = start_at
   - plan change during trial → replacement keeps the original `start_at`

## Known behaviour (confirm)

- **Cancel during trial:** access ends when Razorpay's cancelled webhook lands,
  not at day 60. Same as the referral month today. Step 0 tells us exactly when.
- Existing paying subscribers are untouched; this only affects new checkouts.
