# WhatsApp reminders

A client who adds a phone number verifies it with a WhatsApp OTP. **Only once it's
verified** do their session and payment reminders go to WhatsApp instead of email. An
unverified number gets no WhatsApp messages at all, except the OTP itself.

- No phone, or phone not yet verified: reminders go by email.
- Phone verified: session and payment reminders go by WhatsApp. If a WhatsApp send fails,
  that reminder goes by email instead.
- Rebook nudges and booking confirmations stay **email-only** (see Decisions).

## Meta side (done 2026-10-21/22)

- Business **Lumno** is verified and its profile is complete, and a payment method is set.
- Number **+91 88106 78208** is registered on the Cloud API. Its Phone Number ID is
  `1431611396694088`.
- A permanent System User token is in `.env` and Vercel as `WHATSAPP_ACCESS_TOKEN`;
  `WHATSAPP_PHONE_NUMBER_ID` is set alongside it (Production and Preview).
- Webhook: the app's callback URL is `https://www.lumno.in/webhooks/whatsapp`, and the
  Lumno WhatsApp account is subscribed to the Lumno app. The app is still **unpublished**
  (development mode). We don't use the webhook (see Skipped).
- Approved templates:

  | Template            | Category       | Language | Params                                      | Used for                          |
  | ------------------- | -------------- | -------- | ------------------------------------------- | --------------------------------- |
  | `lumno_otp`         | Authentication | `en_US`  | body `[code, 'Lumno']`, button `code`       | phone verification code           |
  | `session_reminder`  | Utility        | `en`     | header `{name}`, named body (see below)     | session reminder                  |
  | `payment_reminders` | Utility        | `en`     | header `[name]`, body `[amount, therapist]` | outstanding balance reminder      |
  | `booking_reminder`  | Marketing      | `en`     | —                                           | not used: rebook stays email-only |

  The payment template's name is **plural**. The languages differ, so every send passes
  its template's language explicitly.

## How it works

### `src/lib/server/whatsapp.ts`

- `isWhatsAppConfigured()` is false if `WHATSAPP_ACCESS_TOKEN` or
  `WHATSAPP_PHONE_NUMBER_ID` is missing. Then WhatsApp is off and everything goes by email.
- `sendWhatsAppTemplate(phone, templateName, language, { header?, body?, button? })` is a
  plain `fetch` to the Graph API. A list fills positional `{{1}}` params; an object fills
  named ones. `button` fills the first button's param (the OTP's copy-code button). Throws
  `WhatsAppSendError` (HTTP status plus Meta's error code) on a non-2xx response.

### Verification: `src/lib/server/phoneVerification.ts`

- **`client.phone` only ever holds a verified number.** A number the client enters waits
  in `client_phone_verification` (one row per client: `phone`, `otp_hash`,
  `otp_expires_at`, `otp_attempts`) until a correct code moves it into `client.phone`.
- `savePhone(clientId, phone)`:
  - `null` clears both (this is the WhatsApp opt-out).
  - Their current verified number drops any pending row.
  - Anything else becomes the pending number. The old verified number keeps getting
    reminders until the new one is verified.
- `sendPhoneCode(clientId)`: 60 s resend cooldown, then rate limits (5/hour per client and
  per number, the number hashed before it reaches Redis), then a 6-digit code whose
  SHA-256 hash is stored with a 10-minute expiry. A failed send drops the code so the
  client can retry straight away.
- `verifyPhoneCode(clientId, code)`: max 5 attempts per code, counted atomically before
  comparing with `timingSafeEqual`. A match moves the number into `client.phone` and
  deletes the row in one transaction.
- UI: `PhoneVerification.svelte`, used on the invite page (optional, skippable) and on
  `/portal/details`.

### Reminders: `src/lib/server/reminderEmails.ts`

- Session and payment reminder loops each pick the channel: phone + WhatsApp configured →
  WhatsApp; if that throws, `logError` and send the email. No phone → email.
- The dedup column (`reminder24hSentAt`, `lastPaymentReminderAt`) is set only if something
  went out, so a phone-only client whose send failed is retried next tick.
- The therapist toggles (`sendSessionReminderEmails`, `sendPaymentReminderEmails`) gate the
  reminder whichever channel it goes on.
- `session_reminder` body: `therapist_name`, `mode` ("online"/"in-person"), `day`
  ("Friday"), `date_text` ("23rd of October"), `start_time`/`end_time` ("10:00 AM"). Times
  use the client's timezone if set; otherwise the therapist's, and `end_time` gets
  " (your therapist's timezone)". The email reminder uses the therapist's timezone.
- Date/time helpers (`formatWhen`, `ordinal`, `formatTime`) live in `src/lib/format.ts`.
- Rebook nudges (email-only): 14 days after the last session, once more at 28 days, then
  stop until they book again.

### Tests

- `tests/integration/phoneVerification.test.ts`: the OTP flow.
- `tests/integration/reminderDelivery.test.ts`: channel choice, fallback, dedup, exact
  template values.
- `tests/integration/rebookReminders.test.ts`: the 14/28/stop ladder.
- `tests/unit/format.test.ts`: `ordinal` and `formatTime`.

## Decisions

1. **Meta Cloud API over plain `fetch`.** No SDK and no new dependency.
2. **Templates only.** Reminders are business-initiated, so Meta only allows approved
   templates.
3. **The therapist toggles still apply** to both channels.
4. **If WhatsApp fails, fall back to email in the same tick.**
5. **Removing the phone number in the portal is the opt-out.** No new toggle.
6. **New numbers must be verified to get WhatsApp.** Numbers collected before verification
   existed were left in `client.phone` on purpose (decided 2026-10-24), so those clients
   count as verified and get WhatsApp reminders without an OTP. If WhatsApp fails for
   one, it falls back to email as usual.
7. **OTP is optional at sign-up.** The invite page offers verification but the client can
   skip it. The portal keeps prompting until they verify.
8. **Rebook nudges stay email-only**, because that template is Marketing. **Booking
   confirmations stay email-only**, because there's no `booking_update` template.

## What's left: rollout

1. Locally: put your own number on a client, verify it through the portal, then hit
   `/api/cron/reminders` with the `CRON_SECRET` and check the WhatsApp arrives.
2. Deploy. Watch Sentry for `reminderEmails.*` and `phoneVerification.send` errors.

## Skipped on purpose

- **Webhook processing and signature check.** Not needed for sending. Delivery failures
  that only show up later (e.g. error 131026, the number isn't on WhatsApp) won't be seen;
  OTP verification covers most of this, since an unreachable number can't verify. The
  subscription is still on in Meta, and `/webhooks/whatsapp` POST only logs. Add an
  `x-hub-signature-256` check before publishing the app or acting on events.
- **Publishing the Meta app.** Only needed for the webhook.
- **WhatsApp booking confirmations.** No `booking_update` template exists.
- **The therapist-side "verified" tick** in `ClientProfileDetails.svelte`.
- A one-off "please verify your number" email to clients who already gave a number.
- A per-client channel preference toggle. A verified number acts as the preference.
- Two-way chat or forwarding replies.
- The 1h-before reminder: still blocked on the Hobby cron limit, same as email.

## Cost note

Meta charges for each utility and authentication template delivered (a fraction of a rupee
each in India). The OTP rate limits cap the authentication spend. At current volume this is
negligible, but it isn't zero like Resend's free tier.
