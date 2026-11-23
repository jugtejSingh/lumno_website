# Choices for reminders — plan

Status: plan, not started. Read this, decide, then approve.

Two parts:

1. **Clients** pick whether their reminders come by WhatsApp or email. WhatsApp is only
   offered once their phone number is verified.
2. **Therapists** pick which notification emails they get about their own practice. Email
   only — therapists never get WhatsApp.

## How it works today

- `client.phone` only ever holds a **verified** number (`phoneVerification.ts`). Legacy
  pre-OTP numbers in that column count as verified, on purpose.
- Session reminders (`sendSessionReminders`) and payment reminders (`sendPaymentReminders`)
  in `reminderEmails.ts` already go **WhatsApp if the client has a phone, else email**, with
  a fallback to email if the WhatsApp send fails. The client has no say.
- Rebook nudges and booking confirmed / cancelled / rescheduled emails are **email only**.
- The therapist gets **no** emails about bookings at all. Every booking email goes to the
  client (or the guest, for discovery calls).
- Therapist toggles in `therapist_settings` (`sendBookingEmails`,
  `sendSessionReminderEmails`, `sendPaymentReminderEmails`, `sendRebookReminderEmails`)
  all control emails **to clients**.

## Part 1 — client picks WhatsApp or email

### Data

One new column on `client`:

| column             | type                                      | notes                         |
|--------------------|-------------------------------------------|-------------------------------|
| `reminder_channel` | enum `'whatsapp' \| 'email'`, default `'whatsapp'` | the client's choice |

Defaulting to `'whatsapp'` keeps today's behaviour for every existing client: those with a
verified phone keep getting WhatsApp, those without keep getting email.

### Rule (one shared function)

```
channel = 'whatsapp'  if  reminder_channel = 'whatsapp'
                          and client.phone is set (i.e. verified)
                          and WhatsApp is configured
channel = 'email'     otherwise
```

- A WhatsApp send that fails still falls back to email, as today.
- A client who picks email **never** gets WhatsApp, even with a verified phone.
- If a client removes their phone, they drop to email automatically. Their saved choice
  stays, so it comes back if they verify a number again.

This replaces the `if (row.clientPhone && isWhatsAppConfigured())` checks in
`sendSessionReminders` and `sendPaymentReminders` with one helper both call.

### Which messages it covers

Only the ones that already have a WhatsApp template: **session reminders** and **payment
reminders**. Rebook nudges and booking confirmations stay email-only until they get Meta
templates (separate piece of work).

### Where the client picks

Portal → Details, next to the phone field:

- **Phone verified** → radio: "Send my reminders by: WhatsApp / Email".
- **Phone not verified** → no choice shown; a line saying reminders come by email, and
  verifying a number lets them switch to WhatsApp.

Server-side, saving `'whatsapp'` without a verified phone is allowed (it just behaves as
email per the rule above) — the UI hiding it is convenience, the rule is the guarantee.

## Part 2 — therapist notification emails

Therapists only get **email**, to their `user.email`. Two new toggles:

### Data

Two new columns on `therapist_settings`:

| column                    | type                         | notes                                    |
|---------------------------|------------------------------|------------------------------------------|
| `notify_me_on_bookings`   | boolean, not null, default true | email me when a client books, cancels or reschedules |
| `notify_me_on_intake`     | boolean, not null, default true | email me when someone completes my intake form       |

### Booking notifications — what triggers one

Only things the therapist **didn't** do themselves:

- A client books, cancels or reschedules from the portal.
- A guest books a discovery call from the outreach page.

Not sent when the therapist creates / cancels / reschedules from their own Calendar —
they already know.

Content: who, what (booked / cancelled / rescheduled / discovery call), when, and a link to
the Calendar. Best-effort, never throws, same contract as `bookingEmails.ts`.

### Intake notifications

See `docs/intake_form.md` → "Therapist email on each response". No answers in the email,
just who and a **View response** link. Gated on `notify_me_on_intake`.

### Where the therapist picks

Settings page, split the existing toggles into two groups so it's clear who gets what:

- **Emails to your clients** — the four existing toggles, unchanged.
- **Emails to you** — "New bookings, cancellations and reschedules" and
  "Intake form responses".

## Modules

- `src/lib/server/reminderChannel.ts` — the one channel rule above (pure, vitest unit test).
- `src/lib/server/therapistNotifications.ts` — the booking notification email to the
  therapist. (The intake one lives in `intakeEmails.ts`.)
- `settings.ts` — read/write the two new toggles alongside the existing ones.

## Needs explicit approval (safety-critical)

1. Migration: new enum + `client.reminder_channel`, two new `therapist_settings` columns.
2. Changing who gets WhatsApp vs email in the reminder crons (outward-facing).
3. New outward-facing emails to therapists on bookings.

## Open questions

1. Defaults for the two therapist toggles — on (proposed) or off?
2. Should a therapist booking notification also fire for client bookings that the
   therapist *approves* later, if approval ever exists? (Currently there's no approval
   step, so proposed: no.)

## Skipped (add when needed)

WhatsApp for rebook nudges and booking confirmations (needs Meta templates), per-message
channel choice (e.g. WhatsApp for sessions but email for payments), SMS.
