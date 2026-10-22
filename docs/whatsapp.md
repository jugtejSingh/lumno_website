# WhatsApp reminders — plan

Goal: a client who adds a phone number can verify it with a WhatsApp OTP. **Only once
it's verified** do their session and payment reminders go to WhatsApp instead of email.
An unverified number gets no WhatsApp messages at all, except the OTP itself.

- No phone, or phone not yet verified: reminders go by email, as they do today.
- Phone verified: session and payment reminders go by WhatsApp. If a WhatsApp send fails,
  that reminder goes by email instead.
- Rebook nudges and booking confirmations stay **email-only** (see Decisions).

## Done (2026-10-21/22)

### Meta side

- Business **Lumno** is verified and its profile is complete, and a payment method is set.
- Number **+91 88106 78208** is registered on the Cloud API. Its Phone Number ID is
  `1431611396694088`.
- A permanent System User token has been generated and is in local `.env` as
  `WHATSAPP_ACCESS_TOKEN`.
- Webhook: the app's callback URL is `https://www.lumno.in/webhooks/whatsapp`, and the
  Lumno WhatsApp account is subscribed to the Lumno app. The app is still **unpublished**
  (development mode). We decided not to use the webhook for now (see Skipped).
- Approved templates:

  | Template            | Category       | Language | Used for                          |
  | ------------------- | -------------- | -------- | --------------------------------- |
  | `lumno_otp`         | Authentication | `en_US`  | phone verification code           |
  | `session_reminder`  | Utility        | `en`     | session reminder                  |
  | `payment_reminders` | Utility        | `en`     | outstanding balance reminder      |
  | `booking_reminder`  | Marketing      | `en`     | not used: rebook stays email-only |

  The payment template's name is **plural**. The languages differ, so every send passes
  its template's language explicitly.

### Code

- `src/lib/server/whatsapp.ts`:
  - `isWhatsAppConfigured()` returns false if `WHATSAPP_ACCESS_TOKEN` or
    `WHATSAPP_PHONE_NUMBER_ID` is missing, which means WhatsApp is off and everything
    goes by email.
  - `sendWhatsAppTemplate(phone, templateName, language, bodyParams, buttonParam?)` is a
    plain `fetch` to the Graph API. It strips the `+` from the phone and throws
    `WhatsAppSendError` (HTTP status plus Meta's error code) on a non-2xx response.
    `buttonParam` fills the first button: the code on `lumno_otp`'s copy-code button, or
    a URL button's trailing `{{1}}`.
- Schema: new table `client_phone_verification` in
  `src/lib/server/db/phoneVerification.schema.ts`. The `client` table is untouched.
  - Columns: `client_id` (primary key, cascades), `phone`, `verified_at`, `otp_hash`,
    `otp_expires_at`, `otp_attempts`.
  - A client counts as **verified only while `verified_at` is set AND `phone` equals
    `client.phone`**. Changing the number therefore un-verifies them, and a code sent to
    the old number can't verify the new one. `setClientPhone` doesn't need changing.
  - Migration: `drizzle/0005_demonic_starjammers.sql` (create table + FK only).
    **Check that `npm run db:migrate` has been run before starting the next steps.**

## Decisions

1. **Meta Cloud API over plain `fetch`.** No SDK and no new dependency.
2. **Templates only.** Reminders are business-initiated, so Meta only allows approved
   templates.
3. **The therapist toggles still apply.** `sendSessionReminderEmails` and
   `sendPaymentReminderEmails` gate the reminder whichever channel it goes on. The dedup
   columns (`reminder24hSentAt`, `lastPaymentReminderAt`) are set after either channel
   succeeds.
4. **If WhatsApp fails, fall back to email in the same tick.**
5. **Removing the phone number in the portal is the opt-out.** No new toggle.
6. **Only verified numbers get WhatsApp.** Numbers already collected are unverified, so
   those clients stay on email until they verify.
7. **OTP is optional at sign-up.** The invite page offers verification but the client can
   skip it. The portal keeps prompting until they verify.
8. **Rebook nudges stay email-only**, because that template is Marketing. **Booking
   confirmations stay email-only**, because there's no `booking_update` template.

## What's left

### Step A: `src/lib/server/phoneVerification.ts` ⚠️ auth-adjacent + DB writes

- `sendPhoneCode(clientId)`:
  - Requires a saved `client.phone` that isn't already verified.
  - Allows one resend per 60 s, enforced by checking `otpExpiresAt - 9 min > now` when
    the row is for the same phone.
  - Allows 5 sends per hour per client, using a new `phoneOtpRatelimit` in `rateLimit.ts`
    (same pattern as `feedbackRatelimit`). This caps spend on Meta messages.
  - Generates the code with `crypto.randomInt(0, 1_000_000)`, zero-padded to 6 digits.
  - Upserts the row: `phone = client.phone`, hash and expiry set, attempts reset to 0,
    `verified_at` cleared.
  - Sends `lumno_otp` (`en_US`) with the code as the body param **and** the button param.
- `verifyPhoneCode(clientId, code)`:
  - Fails if the row's phone ≠ `client.phone`, if the code has expired, or if there have
    been 5 or more attempts. The client then has to request a new code.
  - Otherwise increments attempts, then compares the SHA-256 hashes with
    `timingSafeEqual`.
  - On a match, sets `verified_at = now` and clears the hash, expiry and attempts.
- `isPhoneVerified(clientId)` (or a join helper for the reminder selects).

### Step B: UI — `PhoneVerification.svelte` (new component)

- Shows a **Verified** badge next to a saved number, or a **Verify on WhatsApp** button.
- The button runs a `sendCode` form action and reveals a 6-digit input (with
  `inputmode="numeric"` and `autocomplete="one-time-code"`) and a **Resend** link.
- The input runs a `verifyCode` form action. Errors are plain: "Code expired, send a new
  one", "Wrong code, N tries left".
- Used in two places:
  1. **Invite sign-up page** (`src/routes/invite/[token]/`). It's optional and can be
     skipped. The actions authorise via the invite token (`invite.id`), the same way
     `setClientPhone` is called there.
  2. **`/portal/details`** (`src/routes/(portal)/portal/details/`). The actions use
     `locals.clientId`.

### Step C: tests

- Unit: the code is always 6 digits, so leading zeros are kept. Hashing is stable.
- Integration (test DB, with Meta `fetch` and the ratelimit mocked):
  - send stores a hash, not the code
  - the right code verifies and the wrong code increments attempts
  - the 6th attempt is rejected
  - an expired code is rejected
  - changing `client.phone` makes them unverified, and the old code can't verify the new
    number
  - saving the same number keeps verification

### Step D: copy

Change "add a number" to "add **and verify** a number" in: the portal hint, the invite
hint, `GuidePortal`, and `GuideNotifications`.

### Step E: env vars in Vercel (you're doing this one)

Add these to Production and Preview:

- `WHATSAPP_ACCESS_TOKEN`: the System User token (already in local `.env`)
- `WHATSAPP_PHONE_NUMBER_ID` = `1431611396694088`

Until both are set, WhatsApp is off: OTP sends fail with a clear error, and reminders go
by email.

### Step F: route session and payment reminders through WhatsApp

- First, read the variables and buttons of `session_reminder` and `payment_reminders`
  (with the WhatsApp MCP `get_template`) so the params line up.
- Add one helper, `deliverReminder(...)`:
  - If the client has a **verified** phone and WhatsApp is configured, try WhatsApp. If it
    throws, log it with `logError` and fall through to email.
  - Otherwise send email. If there's neither a verified phone nor an email, skip.
- Use it in `reminderEmails.ts`, in `sendSessionReminderBatch` and `sendPaymentReminders`
  only. Join `client_phone_verification` in their selects, and change the
  `if (!row.clientEmail) continue` guards to "no email **and** no verified phone".
- `sendRebookReminders` and `bookingEmails.ts` stay email-only.
- Tests (with `fetch` mocked):
  - a verified phone gets WhatsApp and no email
  - a WhatsApp failure falls back to email
  - an unverified or missing phone gets email
  - the dedup column is set exactly once in each case

### Step G: rebook cadence change ✅ decided: do it

Change rebook nudges from "4 days, 11 days, then every 14 days forever" to **"14 days,
28 days, then stop"**. Email only, no WhatsApp. In `sendRebookReminders`:
`daysSinceSession >= 28` → stage 2, `>= 14` → stage 1, and send only when
`targetStage > effectiveStage` (delete the "repeat stage 2 every 14 days" branch). The
auto-reset on a new booking stays. No schema change. Also
update the comments in `users.schema.ts` and `appointments.schema.ts`, update the copy
(`settings/+page.svelte:462`, `GuideNotifications.svelte:24-25`), and rewrite
`tests/integration/rebookReminders.test.ts`.

### Step H: rollout

1. Locally: point a client row at your own number, verify it through the portal, then hit
   `/api/cron/reminders` with the `CRON_SECRET` and check the WhatsApp arrives.
2. Deploy with the env vars set. Watch Sentry for `reminderEmails.*` and WhatsApp send
   errors.

## Skipped on purpose

- **Webhook processing and signature check.** We don't need it for sending. Delivery
  failures that only show up later (e.g. error 131026, the number isn't on WhatsApp)
  won't be seen. OTP verification covers most of this, since an unreachable number can't
  verify. The subscription is still on in Meta, and `/webhooks/whatsapp` POST only logs.
  Add an `x-hub-signature-256` check before publishing the app or acting on events.
- **Publishing the Meta app.** Only needed for the webhook.
- **WhatsApp booking confirmations.** No `booking_update` template exists. Add one later
  if wanted.
- **The therapist-side "verified" tick** in `ClientProfileDetails.svelte`.
- A one-off "please verify your number" email to clients who already gave a number. Add
  it if few of them verify on their own.
- A per-client channel preference toggle. A verified number acts as the preference.
- Two-way chat or forwarding replies.
- The 1h-before reminder: still blocked on the Hobby cron limit, same as email.

## Cost note

Meta charges for each utility and authentication template delivered (a fraction of a rupee
each in India). The OTP rate limit (5 sends per hour per client) caps the authentication
spend. At current volume this is negligible, but it isn't zero like Resend's free tier.
