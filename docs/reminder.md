# Reminders (email) — plan

Cron-driven reminder emails, reusing the existing `sendEmail` / `bookingEmails.ts`
patterns. Vercel Cron triggers a route handler; no queue or new dependency.

## Session reminders

- Fires at 24h and 1h before `appointment.startAt`, confirmed appointments with a
  client email only.
- Dedup via two new nullable columns on `appointment`: `reminder24hSentAt`,
  `reminder1hSentAt`.
- Cron runs every ~15 min so the 1h window isn't missed.

## Payment reminders

- Nags clients with `owed > 0` (reuse `listOutstandingBalancesByClient`).
- Throttled to once/week via a new nullable `client.lastPaymentReminderAt`.

## Settings

- One new `therapistSettings.sendReminderEmails` boolean, same pattern as the
  existing `sendBookingEmails`, gates both jobs.

## Files (in order)

1. `appointments.schema.ts` / `users.schema.ts` — add the three columns, then
   `npm run db:push` (no migrations pre-prod, see project CLAUDE.md)
2. `settings.ts` — `sendReminderEmails` get/update, mirroring `sendBookingEmails`
3. `src/lib/server/reminderEmails.ts` — `sendSessionReminders()` +
   `sendPaymentReminders()`, never-throws like `sendAppointmentEmail`
4. `src/routes/api/cron/reminders/+server.ts` — checks
   `Authorization: Bearer $CRON_SECRET`, calls both functions, returns 200
5. `vercel.json` — cron schedule (`*/15 * * * *`)
6. Settings UI — checkbox next to the existing `sendBookingEmails` toggle
   (e.g. `SettingsDialog.svelte`)

## Status

Not started.
