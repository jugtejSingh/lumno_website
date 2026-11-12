# Payment overhaul — plan

Goal: switch the payments page between four periods (last 30 days, a calendar month,
last 365 days, a calendar year), see Unpaid / Paid / Total for that period, and use
"Who owes you" to see who owes what and for which session. A charge you forgot to
collect months ago must still be easy to find.

**No schema change or migration.** Everything below reads the existing `payment`,
`appointment` and `client` tables.

---

## What exists today (for reference)

- `/payments` page: 3 stat cards (Paid / Unpaid / Total, **this month only**), a Packs
  column, and a "Who owes what" column.
- "Who owes what" (`listOutstandingBalancesByClient`) shows **all-time unpaid only**,
  one row per person, biggest first. Clicking a client opens their full history;
  walk-ins can't be clicked.
- `ClientSidebar` lists every client; clicking a name opens `ClientPaymentsDialog` with
  that client's full history. This stays as it is.
- Paid money is bucketed by when it was paid (`paidAt`), unpaid by when it was booked
  (`createdAt`). Month bounds are UTC.
- An unpaid charge shows as due from 2 days **before** its session (`chargeIsVisible`).

---

## The rules

### Period switch (`?period=…`, default `30d`)

One segmented control with four options:

| Option | `period` value | Range |
|---|---|---|
| **Last 30 days** (default) | `30d` | now − 30 days → no end (see below) |
| **Monthly** | `month:2026-11` | that calendar month, `‹ ›` arrows |
| **Last 365 days** | `365d` | now − 365 days → no end (see below) |
| **Yearly** | `year:2026` | that calendar year (Jan–Dec), `‹ ›` arrows |

- **Every period places a charge by its session date** (`appointment.startAt`).
  Charges with no session (ad-hoc charges, walk-ins, pack purchases) use the date the
  charge was added (`payment.createdAt`).
- **The booking date and the payment date never matter.** A session on 6 Nov, booked
  on 30 Oct and paid on 3 Dec:
  - counts in **November** in Monthly view, as paid
  - counts in **2026** in Yearly view
  - shows in Last 30 / 365 days while **6 Nov** is inside the window
- **Prepaid future sessions.** The rolling windows (30 / 365 days) have no end date, so
  a session that hasn't happened yet but is already paid shows as **Paid** straight
  away. An unpaid future session still isn't counted, because of the "session has
  started" rule below. Monthly and Yearly are fixed ranges, so a prepaid session
  already shows in its own month or year.
- The forward arrow stops at the current month or year. An invalid or future `period`
  falls back to `30d`.
- Month and year bounds use the therapist's `timezone` (default Asia/Kolkata), not UTC.

### When does a charge count as unpaid?

- An unpaid session charge only counts as **Unpaid** once its session has **started**
  (`appointment.startAt <= now`). Before that it's upcoming and isn't counted
  anywhere. If it has already been paid in advance, it counts as Paid.
- Ad-hoc charges, pack purchases and cancellation fees have no session to wait for, so
  they count as Unpaid straight away.
- This applies to the therapist's `/payments` page only. The client portal is
  unchanged: a charge still shows as due 2 days before the session, so clients can
  pay ahead (decided).

### The numbers for a period

- **Paid** = paid charges placed in the period.
- **Unpaid** = unpaid charges placed in the period that count as unpaid (rule above).
- **Total** = Paid + Unpaid.

---

## The page

1. Header (+ Add pack, + Add charge) and the double-charge alerts are unchanged.
2. **Period switch** with the four options, plus arrows in Monthly and Yearly modes.
3. **Stat cards: Unpaid, Paid, Total** for the selected period. All three are plain
   numbers; none of them opens anything.
4. Packs column, unchanged.
5. **"Who owes you"** (renamed from "Who owes what"): all-time unpaid, one row per
   person, so it's not tied to the period switch. Changes from today:
   - uses the same "session has started" rule as the Unpaid stat card
   - still sorted by biggest amount owed first (decided)
   - covers all time, so a charge forgotten more than a year ago still shows
   - clicking a client works as today: it opens their existing history dialog
     (`ClientPaymentsDialog`), which already lists unpaid charges first. Walk-in rows
     stay unclickable, as today. There's no new modal (decided).

---

## Server changes (`src/lib/server/payments.ts`)

1. **New** `parsePeriod(raw, timezone, now)` returns
   `{ kind: '30d' | 'month' | '365d' | 'year', start, end: Date | null, label, prev?, next? }`
   (`end` is null for the rolling windows).
   It does all of the period rules above in one place.
2. `getMonthlyPaymentSummary` becomes `getPaymentSummary(therapistId, start, end)`. It
   places every charge by `coalesce(appointment.startAt, payment.createdAt)` and applies
   the "session has started" rule to unpaid charges.
3. A new SQL fragment `countsAsUnpaid()` (`appointment.startAt <= now` or there's no
   session; cancelled sessions always count) sits next to `chargeIsVisible()`.
   `chargeIsVisible` stays as it is for the portal and the client history dialog.
4. `listOutstandingBalancesByClient` stays, but uses `countsAsUnpaid()` instead of
   `chargeIsVisible()`. That's a one-line change.

`+page.server.ts` load: `parsePeriod` reads `?period=`, which goes to
`getPaymentSummary`. Everything else it loads is unchanged.

---

## Components (`src/lib/components/Payments/`)

| File | New/changed | Does |
|---|---|---|
| `PeriodSwitch.svelte` | new | The 4-option toggle, plus `‹ label ›` arrows for month and year. Plain links that set `?period=` |
| `routes/(app)/payments/+page.svelte` | changed | Adds the period switch and renames the column to "Who owes you" |

`ClientSidebar`, `ClientPaymentsDialog`, `PaymentHistoryList`, `AddChargeDialog` and
`PacksMakerDialog` stay untouched.

---

## Tests

- `tests/unit/` — `parsePeriod`, pure date logic with no DB:
  - each of the four kinds and its range
  - arrows stop at the current month or year
  - an invalid or future value falls back to `30d`
  - month bounds in Asia/Kolkata (02:00 IST on the 1st is inside that month)
- `tests/integration/payments.test.ts`:
  - The 30 Oct booking / 6 Nov session / 3 Dec payment example: it counts in
    November (Monthly), in 2026 (Yearly), and in Last 30 days only while 6 Nov is
    inside the window. The booking date has no effect.
  - An unpaid session that hasn't started yet isn't in Unpaid; once it starts, it is.
  - A 45-day-late payment stays in the session's month.
  - A prepaid session next week counts as Paid in Last 30 days; the same session
    unpaid counts nowhere.
  - `listOutstandingBalancesByClient` still includes a charge older than 365 days, and
    now leaves out unpaid sessions that haven't started.
- `tests/integration/paymentsPage.test.ts`: load with each period kind; a bad `period`
  falls back to `30d`.
- `tests/e2e/payments.test.ts`: one smoke test. Switch between the four periods and
  check the stat cards update.

---

## Order of work (one step at a time, approval between)

1. `parsePeriod` plus its unit tests.
2. `countsAsUnpaid` and `getPaymentSummary`, plus integration tests.
3. Switch `listOutstandingBalancesByClient` to `countsAsUnpaid`, plus a test.
4. `+page.server.ts` load.
5. `PeriodSwitch` wired into the stat cards, and the rename to "Who owes you".
6. E2E smoke test.

---

## Open questions

None. All decided.
