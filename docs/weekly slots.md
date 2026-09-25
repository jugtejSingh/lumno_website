# Weekly slots overhaul

Status: built, but `appointment.slot_id` isn't pushed yet and the tests haven't been run. This is the single spec for weekly slots. It supersedes the earlier walkthrough and `bugs.md`, and every decision from those is included here.

## What the product should do

1. The therapist opens Weekly slots, picks a day, and adds a time. Clients can book it.
2. A **reserved slot** is a weekly slot with `reservedClientId` set. That client is booked into it every week automatically, and clients never see it.
3. **Client-facing rule:** a slot is shown only if it has no `reservedClientId` and nothing is booked over it.
4. **Deleting or changing an open (unreserved) slot** keeps every session already booked in it. The time just stops being offered.
5. **Deleting or changing a reserved slot** means any change to it: retime, change of day or type, a different client, release, or delete. Each one **deletes** that slot's future sessions (holds). Nothing has happened yet, so:
   - the hold's unpaid payment row is deleted,
   - any pack credit it used is returned,
   - there are no notes to lose,
   - no cancellation or reschedule fee applies. The therapist did it, and can add a charge by hand if they want one.

   Because the rows are gone, A → B → A books A again without any conflict.

## What's wrong today (from reading the code)

| # | Problem | Where |
|---|---|---|
| 1 | **Reserved slots are shown to clients.** `listAvailabilityForMonth` never looks at `reservedClientId`. A reserved slot is only hidden while its hold exists, so any week the cron skipped (or the client cancelled) is offered publicly. | `availability.ts:104` |
| 2 | **An appointment has no link to the slot that created it,** so nothing can find a slot's holds to delete them. Swap, retime, release and delete all leave the old holds in place. | `appointments.schema.ts` |
| 3 | **A → B → A never rebooks, and retiming double-books.** The old holds stay. The cron's "already booked" key (`clientId|startAt`) sees them and skips, or the overlap trigger rejects the new time, and either way it's silent. | `recurringBookings.ts:142-177, 213` |
| 4 | **Whole-week save.** `replaceWeekTemplate` deletes every row not in the payload, so a stale dialog wipes slots (and reservations) added elsewhere. It's last-write-wins. | `availabilitySlots.ts:229` |
| 5 | **Two save models in one dialog.** Slot edits wait in a draft until Save, but reserving saves straight away. So a slot must be saved before it can be reserved, and the modals have to compare the draft with the stored week to guess what changed. | `WeekTemplateDialog.svelte` |
| 6 | **A reserved slot can be made hybrid** through the weekly save. The cron then skips it forever without saying so. | `replaceWeekTemplate` |
| 7 | **The reserve action reports success when booking failed.** `materialiseReservedSlots` errors and overlap skips are only logged, or not logged at all. | `+page.server.ts:231`, `bookCandidate` |
| 8 | **Missing `therapist_settings` row:** the save's UPDATE silently drops caps and holidays. | `availabilitySlots.ts:311` |
| 9 | Deletion safeguards are UI-only (the modals). A request that skips them gets no server-side rules. | modals |

## Tests (written first, before any code)

Write these first and watch them fail. Each build step is done when its tests pass. They are all integration tests against `DATABASE_URL_TEST`, using the existing helpers in `tests/integration/helpers.ts`. "Future" means inside the 14-day window, and each test sets its own times relative to now.

### Remove (they test code that is being deleted)

- `availabilitySlots.test.ts`: the whole `describe('replaceWeekTemplate')` block.
- `recurringBookings.test.ts`: the whole `describe('replaceWeekTemplate keeps saved slots in place')` block. Keep its last test, `getSlotDesign reports the id and reservation of weekly slots`, by moving it into `describe('getSlotDesign')`.
- `calendarActions.test.ts`: the whole `describe('saveWeekTemplate')` block. Its validation cases move to the new action tests below.
- `recurringBookings.test.ts` → `cancels nothing and leaves existing appointments untouched`: keep it, but reword it to "the cron itself never deletes or cancels". Only `deleteFutureHolds` deletes.

### New: `tests/integration/weeklySlots.test.ts` (the `weeklySlots.ts` functions)

`addSlot`
- adds an open weekly slot and returns its id
- allows a slot touching a reserved slot at the edge
- allows a slot that overlaps an open slot on the same day
- rejects a slot that overlaps a reserved slot on the same day

`updateSlot`
- an open slot: updates the row and leaves booked appointments in the old time untouched (product rule 4)
- a reserved slot, time changed: deletes the future holds and keeps the reservation. After the re-book, the client has holds at the new time only (#3)
- a reserved slot, 9:00–10:00 → 9:30–10:30 (overlapping its old time): books the new time every week and nothing is blocked (#3)
- a reserved slot, weekday changed: deletes the old day's holds and books the new day
- a reserved slot, changed to hybrid: rejected, and nothing is deleted or changed (#6)
- a reserved slot saved with no actual change: deletes nothing
- a reserved slot changed to overlap another slot on that day: rejected
- another therapist's slot id: not found, and nothing changes
- a date-override slot id: not found

`deleteSlot`
- an open slot: deletes the row, and its booked appointments stay `confirmed` (product rule 4)
- a reserved slot: deletes the row and all its future `confirmed` holds
- a reserved slot: its past and completed holds stay, with `slotId` set to null
- a reserved slot: a hold the client cancelled themselves stays, with its fee payment, and `slotId` is set to null
- another therapist's slot id: not found, and nothing is deleted

`saveWeekDay`
- saves the cap and holiday for one weekday and leaves the other six alone
- works for a therapist with no `therapist_settings` row (upsert, #8)
- leaves the slots and another therapist's settings alone

`copyDay`
- replaces the open slots on the target days with copies of the source day's slots
- leaves a reserved slot on a target day, and its holds, untouched
- skips a copy that would overlap a reserved slot on the target day
- copying a day onto itself changes nothing
- copies never carry the source's `reservedClientId`
- only touches the signed-in therapist's slots

Stale tab (#1, #2)
- a slot added after the dialog was loaded survives any other slot's update or delete

### New: `recurringBookings.test.ts` → `describe('deleteFutureHolds')`

- deletes only future `confirmed` appointments with this `slotId`
- leaves portal and manual bookings at the same time alone (no `slotId`)
- leaves another slot's holds alone, including the same client's other reserved slot
- leaves an in-progress session alone (`startAt` has passed, `endAt` hasn't)
- deletes the hold's unpaid payment row
- keeps a paid payment row, unlinked (`appointmentId` null)
- keeps an unpaid payment with a `razorpayOrderId` (checkout in progress), unlinked
- a hold on an active pack: the pack's `remaining` goes up by one
- a hold on a `completed` pack: the pack reopens as `active` with one credit
- a hold on a `completed` pack when the client has a newer active pack: the credit moves onto the newer pack
- two holds on the same completed pack: both credits come back
- a client note attached to a hold survives, unlinked
- returns the deleted rows, so the caller can remove their Meet events
- rolls back fully when the caller's transaction throws (no half-deleted holds)

### New: reservations and swaps

The swap tests (A → B, A → B → A, A → open, same client, cancelled week) live in `weeklySlots.test.ts` under `reserveSlot`; the cron-level ones live in `recurringBookings.test.ts`.

- the cron sets `slotId` on every hold it books
- `reserveSlot`'s immediate booking sets `slotId` too
- **A → B:** deletes A's future holds, then books B at every week in the window (#3)
- **A → B → A:** A is booked again at every week, with no duplicates (#3)
- **A → open ("Open to everyone"):** deletes A's future holds, and the slot shows in client availability again
- reserving the same client again (no change): deletes nothing
- a week A cancelled themselves: A is not rebooked that week after A → B → A, but B is booked that week while it holds the slot
- a hold the client rescheduled: the new row has no `slotId` and survives a delete of the slot. The old `rescheduled` row stops the cron rebooking that week
- `materialiseReservedSlots` returns `{ created, blocked, failed }`, and a week blocked by an existing booking counts as `blocked`, not skipped silently (#7)
- keep every existing booking, skip, charge and pack test in this file unchanged

### New: `availability.test.ts` (client visibility)

- a reserved slot never appears in `listAvailabilityForMonth`, even in a week with no hold (#1)
- a reserved slot can't be booked through `createAppointmentForClient` from a stale page (#1)
- an open slot on the same day is still offered
- after release (A → open), the slot is offered again

### New: `calendarActions.test.ts` (form actions)

- `addSlot`, `updateSlot`, `deleteSlot`, `saveWeekDay` and `copyDay`: each saves for the signed-in therapist and returns `fail(400)` with a message for unreadable or invalid input. Input validation (time format, end after start, modality, weekday 0–6, cap 1–50) lives in the actions, so it is tested here; the `weeklySlots.ts` functions trust their input
- new messages: "Could not read that slot — reload and try again" (bad weekday or unreadable fields) and "A reserved slot can’t overlap another slot on the same day"
- `reserveSlot` returns the `created` / `blocked` counts to the page (#7)
- `reserveSlot` on a hybrid slot, an unknown slot, or another therapist's client: `fail(400)` with the existing messages
- every action refuses to touch another therapist's slot (#9: the server enforces the rules, not the modal)

## The fix

### 1. Schema (one column, `npm run db:push`, no migration)

- Add `appointment.slotId`: text, nullable, references `availability_slot.id` with **`on delete set null`**, plus an index on `slot_id`.
  - It is set only on holds, meaning rows inserted by the cron or by the reserve action. Portal and manual bookings leave it null.
  - Why `set null` and not `cascade`: holds are deleted explicitly by one function (below), with filters. A cascade would also delete a client's own cancelled holds that carry a late fee, plus past sessions.
- **No change to `payment` or `clientNote` foreign keys.** Unpaid payments are deleted explicitly. A paid payment, which shouldn't exist before a session, keeps its row and `set null` just unlinks it, so money received is never lost. A note, if one exists, is unlinked the same way.
- No backfill. The app is pre-production, and old test holds have no `slotId`, so they're treated like manual bookings.

### 2. One function deletes holds: `deleteFutureHolds(tx, slotId)`

Lives in `recurringBookings.ts` and is the only place holds are ever deleted. Inside the caller's transaction it:

1. Selects the holds: `slotId = X`, `status = 'confirmed'`, `startAt > now`.
   - A client's own cancelled or rescheduled weeks are kept. They carry their own fees and history, and they keep blocking the cron from rebooking that client that week, which is correct.
   - Past, in-progress and completed sessions are never touched.
2. Deletes their payments where `status = 'unpaid'` and `razorpayOrderId is null`. A row with a checkout in progress is left alone, and the FK unlinks it.
3. Deletes the appointment rows.
4. For each deleted hold that had a `packId`, calls the existing `returnPackCredit(packId, tx)`. Deleting the row already returns the credit, because a pack's remaining count is derived from the appointment rows. `returnPackCredit` only covers the case where the pack is `completed`: it reopens the pack, or moves the credit onto the client's newer active pack.
5. Returns the deleted rows so the caller can call `detachMeetingLink(row)` for each one **after commit**. This is best-effort, the same as `cancelAppointment` does.

No email to the client. The therapist deleted the sessions and tells the client themselves. (If you want the "cancelled" email sent, it has to happen before the delete, because `sendAppointmentEmail` re-reads the row.)

### 3. Per-slot actions replace the whole-week save

New module `weeklySlots.ts`, with every function scoped by `therapistId`. Each form action saves immediately. There is no draft and no week payload.

| Action | Rule |
|---|---|
| `addSlot(weekday, start, end, modality)` | Validates, then inserts an open slot. |
| `updateSlot(id, weekday, start, end, modality)` | If the slot is reserved and anything changed: rejects `hybrid`, then runs `deleteFutureHolds` and updates the row in one transaction, then re-books after commit. If it's open, just updates the row. |
| `deleteSlot(id)` | If it's reserved: runs `deleteFutureHolds` and deletes the row in one transaction. If it's open, just deletes the row, and booked sessions stay. |
| `reserveSlot(id, clientId \| null)` | Same as today (hybrid check, client check). If the client actually changes (A → B or A → open), runs `deleteFutureHolds` in the same transaction as the update. Re-books after commit. |
| `saveWeekDay(weekday, maxSessions, holiday)` | Sets the cap and holiday for one day, as an **upsert** on `therapist_settings` (fixes #8). |
| `copyDay(from, targets)` | Replaces the **open** slots on each target day with copies of the source day's slots. Reserved slots on the targets are left alone, so a copy never deletes holds. A copy that would overlap a reserved slot on the target day is skipped. |

Validation runs on the server for every action: the time format, end after start, the modality, weekday 0–6, and that the slot is this therapist's weekly slot. `validateDaySlots` keeps its per-slot checks. The overlap check compares against the day's stored slots (see §6).

This fixes #4, #5, #6 and #9. Every rule is enforced on the server, so the modals only confirm, and skipping one can't leave data wrong.

Delete `replaceWeekTemplate`, the `saveWeekTemplate` action, and `parseDesignedSlots`'s use of browser-supplied ids for weekly slots.

### 4. Booking (`recurringBookings.ts`)

- `Candidate` gets a `slotId`, and `bookCandidate` writes it on the insert.
- Keep the "already booked" key as it is (`clientId|startAt`, any status). Deleted holds leave no row, so A → B → A rebooks A. A week the client cancelled themselves stays skipped for that client only, and B is never blocked by A's rows.
- Count overlap skips as `blocked` instead of dropping them silently. `MaterialiseResult` becomes `{ created, blocked, failed }`.
- `reserveSlot` and `updateSlot` return that result, and the UI shows "Booked 2 sessions" or "1 week blocked by an existing session" (fixes #7). The cron logs `blocked`.

### 5. Client visibility (`availability.ts`)

In `listAvailabilityForMonth`, skip every designed slot whose `reservedClientId` is set (fixes #1). `insertAppointmentForClient` goes through the same function, so a stale portal page can't book a reserved slot either. Nothing else changes: the overlap hiding and the daily cap stay as they are.

### 6. Overlapping slots (keep the earlier decision)

- Two **open** slots on the same day may overlap. The dialog shows a non-blocking note, and whichever gets booked first hides the other on that date (this already works in `listAvailabilityForMonth`).
- A **reserved** slot may not overlap another slot on the same day. Otherwise one hold would permanently block the other. `reserveSlot` and `updateSlot` reject it.
- Date overrides keep the current "no overlap" check.

### 7. UI (`SlotDesigner/`)

- `WeekTemplateDialog`: remove the draft, the Save button, `findReservedChanges` and `confirmedSave`. It renders the stored `week`, and each child posts its own action with `enhance`. The page's data refreshes after every action.
- `SlotRow`: its own small form (`updateSlot`), with a trash button (`deleteSlot`).
- `DaySlotsEditor`: an "Add slot" form (`addSlot`), plus the cap and holiday inputs posting `saveWeekDay`, plus "Copy to…" posting `copyDay`.
- `SlotReserveControl`: unchanged apart from the confirm step below. "Save the slot before reserving it" goes away, because every slot has an id.
- Modals, all static text:
  - **Reserved slot, any change** (edit, swap, release, delete) uses one dialog, `ReservedSlotChangeDialog`, reused: "{Client}'s future sessions on this slot will be deleted, along with their unpaid charges. Pack credits are returned." Cancel / Confirm.
  - **Open slot delete** keeps `DeleteSlotDialog`: "Sessions already booked will stay. Clients won't be able to book this time again."
  - Keep `ReserveOverlapDialog` (the client already holds another slot) and `reservedSlotsContext.ts`.

## Known edges (accepted)

- **Holiday or date override on a reserved weekday:** holds that are already booked stay, and the cron stops booking new ones. This is consistent with "booked sessions stay unless the slot itself changes".
- **Client moves a hold with reschedule:** the new row gets no `slotId`, so it's an ordinary booking and survives a later slot delete. The old `rescheduled` row keeps `slotId`, isn't deleted (because it isn't `confirmed`), and stops the cron rebooking that week.
- **Cron races a swap:** the cron can read A as reserved just before a swap commits, then insert A's week. B's week is then blocked, and the therapist sees it as `blocked`. Accepted: the cron runs at 4am, when the therapist is unlikely to be editing slots. The upgrade path is `select … for update` on the slot row in `bookCandidate`.
- **Deactivated client:** the cron skips them, and their existing holds stay until the slot is changed.

## Build order (each step approved before it's built, since steps 1–3 touch DB writes and deletes)

0. Write every test in "Tests" above, and remove the old ones listed there. They should fail until their step is built.
1. Add the `slotId` column. The cron and reserve action set it, and the `blocked` count is added.
2. `deleteFutureHolds`, plus the reserve action using it.
3. `weeklySlots.ts` actions, and remove `replaceWeekTemplate`.
4. Hide reserved slots from clients (a one-line filter; it can ship first on its own).
5. UI: per-row forms, one confirm dialog, the overlap note.
