# Reschedule / buffer / time-handling review walkthrough

A manual pass over the appointment time logic. Check each box against the code +
a quick DB poke. Files: `src/lib/server/appointments.ts`, `availability.ts`,
`timezone.ts`, `paymentPolicy.ts`, `db/appointment_no_overlap.sql`.

## Overlap + buffer

- [ ] `appointment_no_overlap.sql`: buffer pads the **end** of both ranges only
      (`end_at + buffer`), never the start. Confirm a 3–4pm appt with 10min buffer
      blocks up to 4:10pm and that 4:10pm itself books fine.
- [ ] `buffer_minutes = 0` still allows back-to-back (3–4, 4–5).
- [ ] Trigger fires `WHEN (NEW.status = 'confirmed')` only — a `cancelled` /
      `rescheduled` row neither triggers nor blocks.
- [ ] `hasBufferOverlap()` in `appointments.ts` matches the trigger math exactly
      (`existing.start < newEnd + buf && newStart < existing.end + buf`).
- [ ] Buffer value: `hasBufferOverlap` reads `getTherapistScheduleSettings`
      (`therapist_settings.buffer_minutes`, default 0). Trigger reads the same
      column. Change the setting, confirm both move together.
- [ ] `availability.ts:~99` (client slot list) uses buffer on **both** sides of
      the slot — that's deliberate (hiding a slot ≠ rejecting a booking), but
      note the asymmetry with the trigger.

## Reschedule flow (`rescheduleAppointmentForTherapist` → `finishReschedule`)

- [ ] Order inside `finishReschedule`'s tx: insert new row **first**, then flip
      old row to `rescheduled`. So at insert time the old row is still
      `confirmed`.
- [ ] Consequence: rescheduling into a slot that overlaps the appointment's **own
      original time** is rejected (trigger + `hasBufferOverlap` both see the old
      row). Decide if that's acceptable UX — e.g. "move my 10:00 to 10:30" fails.
- [ ] Overlap now returns `{ error: 'overlap' }` (was a raw throw before the
      pre-check). Verify: reschedule onto another confirmed appt → clean error,
      old row still `confirmed`, no new row, tx rolled back.
- [ ] `not_found` when old id is unknown / already `cancelled` / already
      `rescheduled`.
- [ ] `rescheduledFromId` on the new row points back at the old row.
- [ ] Financial links move: `moveFinancialLinksOnReschedule` — `payment` rows and
      `pack_id` reassign from old → new appointment. Old row's `pack_id` ends up
      NULL.
- [ ] Meet link moves: `moveMeetLinkOnReschedule` + `syncMeetEventOnReschedule`
      (mocked in tests — verify by hand against a real Google-connected account,
      or just read the code path).
- [ ] `sendAppointmentEmail(..., 'rescheduled', { previousStartAt, feeAmount })`
      fires after the tx with the pre-move start time.

## Cancellation / reschedule fee tiers (`paymentPolicy.ts`, `resolveOutcomeFor`)

- [ ] Tier depends **only** on the ORIGINAL appt `start_at` + settings + client
      rate + `now` — nothing about the new time changes what's owed.
- [ ] Windows from `payment_settings`: `free_change_window_hours` (default 24),
      `partial_change_window_hours` (default 8). `updatePaymentSettings` rejects
      partial >= free.
- [ ] `>= free window` notice → `free` tier, fee 0. On cancel, a free-tier
      cancellation with a `pack_id` **returns the credit** (clears `pack_id`), no
      charge.
- [ ] Between the two windows → `partial`, fee = 50% of rate.
- [ ] `< partial window` (incl. past) → `full`, fee = 100% of rate.
- [ ] Fee charge note: `feeNote('cancellation'|'reschedule', tier)` →
      `"Late cancellation fee (50%)"` etc. Reschedule fee is charged against the
      **new** appointment id.
- [ ] Client-initiated cancel must pass its own `clientId` (therapist calendar
      may omit it); mismatched clientId → `not_found`.

## Timezone (`timezone.ts`)

- [ ] `zonedDateToUTC(y, m, d, h, min, tz)` — the therapist calendar sends wall
      -clock parts; this converts using `therapist.timezone` (default
      `Asia/Kolkata`). Client path uses the same.
- [ ] DST: pick a therapist tz that observes DST (e.g. `America/New_York`), book
      across a spring-forward / fall-back boundary, confirm `start_at` UTC is
      right and the slot list shows the expected local hour.
- [ ] `zonedDayBounds` / `getZonedWeekday` / `getZonedDateParts` — month grid and
      "which day is this" all agree for a tz with a negative UTC offset near
      midnight.
- [ ] `time` columns (`earliest/latest_booking_time`) come back as
      `'HH:MM:SS'` strings — anything comparing them parses, doesn't string-compare
      past `'09:00'` vs `'09:00:00'`.
- [ ] `invalid_range` when computed `endAt <= startAt` (e.g. end hour < start
      hour with same day).

## Quick DB pokes

```sql
-- see the trigger definition actually installed
\df+ check_appointment_no_overlap

-- a therapist's confirmed appts with buffer window
select id, start_at, end_at,
       end_at + (select coalesce(buffer_minutes,0) from therapist_settings s
                 where s.therapist_id = a.therapist_id) * interval '1 minute' as blocked_until
from appointment a
where therapist_id = :tid and status = 'confirmed'
order by start_at;
```
