# Bulk add clients (+ invite bounce tracking)

Let a therapist add many clients in one go from whatever they already have: a
messy Excel/Google Sheet, a CSV export, or a pasted message/email listing names
and emails. An AI step pulls `{ name, email, rate }` rows out of the unstructured
text, the therapist reviews and edits the list, then confirms to save.

Alongside it: track invite emails that bounce, so the therapist can see which
addresses were wrong and fix them. Bulk import makes this matter — one bad
sheet means many silent bounces.

## Goals

- Accept unstructured input — no fixed columns, no header row required.
- Never save anything the therapist hasn't seen and confirmed.
- Reuse the existing single-add rules (plan cap, duplicate check, self check,
  invite email) so bulk add can't bypass them.
- Available on every plan; free plan gets a small monthly allowance.
- Show the therapist when an invite email bounced.

## Non-goals (for now)

- `.xlsx` upload. Pasting cells copied from Excel/Sheets arrives as
  tab-separated text, which covers it without a new dependency (SheetJS).
  Add later if therapists ask for it.
- Importing phone or custom fields. Name, email and price per session only.
- Bounce tracking for emails other than invites (reminders, booking emails).

---

## Part 1 — Bulk add

### User flow

1. Clients page → **"Add many"** button opens a dialog. Free plan sees how
   many imports are left this month.
2. Therapist pastes text into a textarea: cells copied from Excel/Sheets
   (tab-separated), CSV text, or a message listing names and emails. No file
   upload.
3. **"Find clients"** → server runs AI extraction → dialog shows an editable
   table: name, email, price, remove button, and a flag column. A "+ Add row" button adds a blank row.
   Price: the paste step has a "usual price per session" field (blank = 0). The AI
   returns a price only when one appears for that person; every other row, and
   every hand-added row, starts at the usual price. The server saves any price that
   isn't a whole number from 0 up as 0 (`parseRate` in `bulkClientRows.ts`).
4. Flags shown per row (row stays editable):
   - invalid email
   - missing last name (single-add requires first + last)
   - duplicate within the list
   - already a client
5. Therapist fixes/removes rows, then **"Add N clients"**.
6. **Before saving, if the list would go over the plan's client cap**, the
   review step shows a notice: "Your plan allows 10 active clients. The first
   10 will be active and can book. The other 30 will be added as inactive —
   they'll get an invite and can use their portal, but can't book sessions
   until you upgrade." with an upgrade link. Therapist can still confirm.
7. Results summary per row: added (active) / added (inactive) / skipped
   (reason) / not added (inactive limit reached). Any invite links whose email
   failed to send are listed so the therapist can share them by hand.
8. On the clients list, inactive clients get an "Inactive — can't book" badge.

### Plan access

`THERAPIST_PLAN_USAGE` in `src/lib/server/billing.ts` gets a new key:

```ts
0: { clients: 10, bulkImportsPerMonth: 3 },
1: { clients: 30, aiTokensPerMonth: 1_000_000, bulkImportsPerMonth: Infinity },
2: { clients: Infinity, aiTokensPerMonth: 3_000_000, bulkImportsPerMonth: Infinity }
```

- One "import" = one successful `extract` call (the AI step). Retrying the
  same paste counts again — it costs tokens again.
- Free plan has no `aiTokensPerMonth`, so bulk extraction must **not** go
  through `aiAccessBlock`. New guard `bulkImportBlock(therapistId)` checks
  `bulkImportsPerMonth` against this month's count instead.
- Paid plans: tokens still count toward their `aiTokensPerMonth` (recorded by
  the existing `recordTokenUsage`), and `aiAccessBlock` still applies to them
  so a paid therapist at their token cap is stopped.
### Over the client cap: add as inactive, still invite

Free plan's 10-client cap does **not** stop the import. Rows past the cap are
saved as **inactive** clients and still get their invite email straight away.

- Reuses the existing over-cap state: `client.deactivatedAt` (the same one
  `syncClientActivationForCap` sets on downgrade). Inactive clients don't
  count toward the cap, can accept the invite and use the portal, but can't
  book new sessions (`availability.ts` → `client_inactive`).
- When the therapist upgrades, `syncClientActivationForCap` already
  reactivates them oldest-first. No new logic.
- `addClient` gets an `allowInactive` option (bulk add only): when the cap is
  reached, insert with `deactivatedAt = now()` instead of returning
  `limit_reached`. Single add is unchanged.
- **Spam guard:** total inactive clients per free therapist capped at **50**
  (new plan key `inactiveClients: 50` on tier 0; Infinity elsewhere is moot
  since paid caps are higher/unlimited). Rows past that are not added and are
  reported as "not added — limit reached". Protects our Resend sending
  reputation from a free account mailing hundreds of addresses.
- Applies to any plan whose cap is hit (Basic at 30 too), not just free.

**Counter storage (schema change):** add `bulk_imports integer not null
default 0` to the existing `ai_usage` table (already one row per therapist per
month, resets on its own). Incremented with the same upsert pattern as
`recordTokenUsage`.

### Server

#### `src/lib/server/ai.ts` — `extractClients`

```ts
export async function extractClients(
	therapistId: string,
	text: string
): Promise<{ name: string; email: string }[] | null>;
```

- Reuses `callOpenRouter` with `jsonMode = true` (same ZDR provider config).
- System prompt: extract only people whose name and/or email literally appear
  in the text; never invent or guess an email; return
  `{"clients": [{"name": "...", "email": "..."}]}`; empty string for a missing
  name.
- Parse the outermost `{...}` like `summarizeNoteForClient` does; drop entries
  that aren't strings.

#### `src/lib/server/bulkClients.ts` (new)

- `flagRows(rows, existingEmails)` — pure, no DB. `isValidEmail`, lower-cased
  in-list and existing duplicate checks, name must contain a space (matches
  the `add` action rule). Unit tested.
- `bulkImportBlock(therapistId)` and `recordBulkImport(therapistId)` — the
  monthly allowance check and counter upsert on `ai_usage`.

#### `src/routes/(app)/clients/+page.server.ts` — two new actions

**`extract`**
- `bulkImportBlock` → if blocked, `fail(429, { message })` with "used all 3
  imports this month, upgrade for unlimited".
- Paid plans: also `aiAccessBlock`.
- Rate limit via existing `rateLimit.ts`.
- Reject input over a size cap (e.g. 20,000 characters).
- Call `extractClients`; on success `recordBulkImport`; then `flagRows`
  against the therapist's existing client emails. Return rows. **No clients
  saved.**

**`bulkAdd`**
- Receives the confirmed rows (JSON in a hidden field).
- Re-validates server-side with `flagRows` — never trusts the client's flags.
- Hard cap on row count per request (e.g. 200).
- Loops, calling the existing `addClient` for each valid row, sequentially.
  `addClient` already takes the therapist lock, checks the plan cap, dedupes,
  and sends the invite after commit.
- Calls `addClient` with `allowInactive: true`, so rows past the plan cap are
  saved inactive and invited. Only the inactive-client limit (50) stops the
  loop; the rest are marked "not added — limit reached".
- Does not count as an import (only `extract` does).
- Returns per-row results plus invite URLs for any `emailSent: false`.

### Front end

- `src/lib/components/Clients/BulkAddClients.svelte` — the dialog (existing
  `Dialog`, `Textarea`, `Button`, `Badge`). Two states: input and review.
- `src/lib/components/Clients/BulkClientRow.svelte` — one editable row with
  flags.
- `src/lib/components/Clients/BulkAddResults.svelte` — results summary.
- Clients page gets the "Add many" button next to the existing add form.

### Client-facing message for inactive clients

Today an inactive client only finds out after picking a slot, and the message
leaks the therapist's billing: *"Your practitioner needs to upgrade their plan
before you can book a new session"*
(`src/routes/(portal)/portal/calendar/+page.server.ts:68`).

Change:
- New message, no mention of plans or upgrades: **"You can't book with your
  practitioner for the time being. You'll be able to book soon."**
- Shown **up front** as a banner on the portal calendar (the load function
  already knows the client; add `inactive: boolean` to its data), and booking
  slots are not clickable while inactive — not just as an error after
  clicking.
- The same text replaces the `client_inactive` error message as a fallback.
- The outreach page (`outreach/[token]`) keeps its existing neutral "That
  time is no longer available".

---

## Part 2 — Invite bounce tracking

### Today

- **Shown:** if Resend rejects the send immediately (bad address, API error),
  `addClient` returns `emailSent: false` and the page shows the invite link.
- **Not shown:** real bounces. Resend accepts the email, then the recipient's
  server rejects it later (mailbox doesn't exist, inbox full). Resend reports
  this as an `email.bounced` webhook, which we don't handle.

### Change

**Schema (migration):** on `client`:
- `invite_email_id text` — the Resend email id returned by `emails.send`, so a
  webhook can be matched back to the client.
- `invite_bounced_at timestamp` — set on bounce, cleared on resend / email
  edit.

**`src/lib/server/email.ts`:** `sendEmail` returns the Resend `data.id`
(currently discarded). Other callers ignore it.

**`src/lib/server/clients.ts`:** `sendInvite` stores the returned id in
`client.invite_email_id` and clears `invite_bounced_at` — in both `addClient`
and `resendInvite`.

**`src/routes/webhooks/resend/+server.ts` (new):**
- Verify signature with `resend.webhooks.verify(...)` (in the installed Resend
  SDK) using a new `RESEND_WEBHOOK_SECRET` env var. Reject unverified with 400.
- On `email.bounced` (hard bounces only — soft/temporary ones aren't the
  therapist's problem): `update client set invite_bounced_at = now() where
  invite_email_id = <data.email_id>`.
- Ignore every other event type; always 200 on verified events so Resend
  doesn't retry.
- No client email address in logs.

**Clients list UI:** "Invite bounced" badge on affected rows, with a prompt to
check the address and "Resend invite". Editing the client's email clears the
flag. Bulk add results don't wait for bounces (they arrive minutes later) —
the badge shows up on the list afterwards.

**Setup (manual, in the Resend dashboard):** add a webhook pointing at
`https://<domain>/webhooks/resend` for `email.bounced`, copy the signing
secret into `RESEND_WEBHOOK_SECRET` on Vercel and in `.env.example` (name
only).

---

## Migration

One migration covering both parts:
- `ai_usage.bulk_imports`
- `client.invite_email_id`, `client.invite_bounced_at`

Edit schema → `npm run db:generate`. The user reviews and runs
`npm run db:migrate`.

## Limits and safety

- Plan client cap enforced per row by `addClient`.
- Free plan: 3 imports per month. Paid: unlimited imports, still inside their
  AI token cap.
- Input size and row count capped; extract action rate limited.
- Client names/emails are sent to OpenRouter under the same zero-data-retention
  setup the notes AI uses. **Privacy page should say client contact details
  are processed this way when using bulk import.**
- Prompt-injection risk is low: the model only returns a list the therapist
  reviews, and the server re-validates every row.
- Webhook endpoint is public, so signature verification is mandatory.

## Decisions

1. **Invites go out straight away** for every added row, active or inactive.
2. **Free allowance:** 3 imports per calendar month.
3. **Over-cap rows** are added as inactive and invited, not rejected.
4. **Inactive-client cap** on free: 50 (default — change if needed).

## Testing

- Unit: `flagRows` (invalid email, missing surname, in-list dup, existing dup,
  case-insensitive emails).
- Integration: `bulkAdd` on free with 40 rows → 10 active + 30 inactive, all
  invited; stops at the 50 inactive limit; single `add` still returns
  `limit_reached`; portal calendar load reports `inactive` for an over-cap
  client;
  re-validates tampered rows; free plan blocked after 3 extracts; webhook
  rejects a bad signature and sets `invite_bounced_at` on a valid bounce.
- AI extraction itself: manual check with a messy sample sheet.
