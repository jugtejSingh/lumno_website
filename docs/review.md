# Review: bulk add clients + invite bounce tracking

Plan: [bulk_add_clients.md](bulk_add_clients.md). Branch: `add_all_clients`.

## Before you merge (manual steps)

1. **Run the migration yourself:** `npm run db:migrate` (`drizzle/0007_natural_texas_twister.sql`, see below). It has not been applied.
2. **Add the env var `RESEND_WEBHOOK_SECRET`** locally and on Vercel. I couldn't add it to `.env.example` (I don't have read access to it), so please add the line `RESEND_WEBHOOK_SECRET=` there too.
3. **Set up the Resend webhook:** in the Resend dashboard → Webhooks, add `https://<your-domain>/webhooks/resend`, subscribe to `email.bounced`, and copy its signing secret into `RESEND_WEBHOOK_SECRET`. Until you do this, bounce tracking never fires. Everything else still works.
4. **Run the integration tests:** `npm run test:integration`. I couldn't run them because the local `postgresql-x64-18` service was stopped and starting it needs admin rights. Unit tests (87/87) and `npm run check` (0 errors, the same 8 warnings as before) both pass.

## Behaviour summary

- **"Add many" on /clients:** paste anything (Excel, CSV, a message) → the AI pulls out names and emails → the therapist edits the rows and removes the bad ones → "Add & invite N" → results screen.
- **Free plan:**
  - 3 successful imports per month. A failed AI read doesn't count.
  - The first 10 clients are active. Anyone past that is still added and invited, but as **inactive**, up to 50 inactive clients. Rows past that are reported as "not added".
- **Inactive clients:** they can sign in to the portal. Their calendar shows "You can't book with your practitioner for the time being. You'll be able to book soon." instead of slots.
- **Bounce tracking:**
  - A permanent bounce of the *latest* invite shows "Invite bounced — check the email" on the client's card.
  - Resending the invite clears the flag.

---

## Backend

### `drizzle/0007_natural_texas_twister.sql` (+ `drizzle/meta/_journal.json`, `drizzle/meta/0007_snapshot.json`)
- Generated with `db:generate`. It's purely additive:
  - `client.invite_email_id`
  - `client.invite_bounced_at`
  - `ai_usage.bulk_imports` (default 0, not null)
  - an index on `invite_email_id`
- **Check:** there are no drops or renames, and it's safe to run on prod with existing rows.

### `src/lib/server/db/users.schema.ts`
- The `client` table gets `inviteEmailId`, `inviteBouncedAt`, and the index `client_inviteEmailId_idx`.

### `src/lib/server/db/ai.schema.ts`
- `aiUsage` gets `bulkImports` (a monthly counter, on the same row as token usage).

### `src/lib/server/billing.ts`
- `THERAPIST_PLAN_USAGE` gets two new keys:
  - `bulkImportsPerMonth`: free 3, paid `Infinity`
  - `inactiveClients`: free 50, paid `Infinity`
- **Check:** the numbers match what you want.

### `src/lib/server/email.ts`
- `sendEmail` now returns the Resend email id, or `null` if the send failed. Callers that ignored the old return value are unaffected.
- New `verifyResendWebhook(payload, headers)`:
  - checks the svix signature using `RESEND_WEBHOOK_SECRET`
  - throws if the secret is missing, so an unset secret is a 400, not "accept everything"
- **Check:** the secret handling.

### `src/lib/server/clients.ts`, the most important file
- **`addClient(…, options.allowInactive)`:**
  - At the active cap with `allowInactive`, it saves the client with `deactivatedAt = now` instead of refusing, as long as there are fewer than `inactiveClients` inactive clients. Otherwise it returns `inactive_limit_reached`.
  - Without the flag (the normal single add), behaviour hasn't changed: `limit_reached`.
  - The limit is read before `withTherapistLock`, the same as the existing cap. The count happens inside the lock.
- **`sendInvite`:** stores the Resend email id on the client and clears `inviteBouncedAt`. This is how a resend clears the bounce warning.
- **New `markInviteBounced(emailId)`:** sets `inviteBouncedAt` on the client whose *current* invite id matches. Bounces of older invites are ignored.
- **Bug fix, please check: `deactivationChange(from, to)`.**
  - Before, `setClientStatus` and `updateClient` reset `deactivatedAt` on *any* status change. That let an over-cap client be reactivated by toggling paused → active.
  - Now `deactivatedAt` only changes when moving into or out of `left`. Moving out of `left` still goes through the existing cap check.

### `src/lib/bulkClientRows.ts` (new, shared client and server, no server imports)
- Limits: `BULK_MAX_TEXT_LENGTH` is 20,000 characters and `BULK_MAX_ROWS` is 200.
- Holds the row/result types, and `flagRows()`, which:
  - trims fields
  - flags an invalid email
  - flags a missing last name (the name has no space)
  - flags `duplicate_in_list` (second and later copies)
  - flags `existing_client`
- The same function runs in the review UI (live) and again on the server before saving. The server never trusts the browser's flags.

### `src/lib/server/ai.ts`
- `currentYearMonth` is now exported.
- New `EXTRACT_CLIENTS_SYSTEM_PROMPT` and `extractClients(therapistId, text)`.
  - The prompt tells the model to return JSON only, never to invent emails, and to treat the pasted text as data and ignore any instructions in it.
  - Output is shape-validated. Anything malformed returns `null`.
- **Check:** the prompt-injection wording, and that token usage is recorded like the other AI calls.

### `src/lib/server/bulkClients.ts` (new)
- `getBulkImportAllowance`: returns `{used, limit}`, where `limit` is null when unlimited.
- `extractBulkClients` runs these steps in order:
  1. Rejects empty text or text over the length cap (400).
  2. Paid tiers go through `aiAccessBlock`, which is their token cap.
  3. Checks the monthly import allowance (429).
  4. Checks the per-hour rate limit (429).
  5. Runs the AI. A failure is a 502 and doesn't count against the allowance.
  6. Records the import.
  7. Truncates to 200 rows and runs `flagRows`.
- `bulkAddClients`:
  - re-flags the rows
  - calls `addClient` one row at a time with `allowInactive`
  - once a limit is hit, marks that row and all later rows `not_added_limit`
  - returns an invite link for any row whose email failed to send
- **Known race (marked `ponytail:`):** two imports started at the same moment can both use the last free slot. The rate limit bounds it. A conditional upsert would fix it if it matters.
- **Check:** sequential adds mean 200 rows is 200 small transactions plus 200 emails in one request. That's fine at this size. Watch the function timeout if you raise `BULK_MAX_ROWS`.

### `src/lib/server/rateLimit.ts`
- New `bulkExtractRatelimit`: 10 per hour per therapist, using Upstash's fixed window.

### `src/routes/(app)/clients/+page.server.ts`
- `load` also returns `activeClientLimit` (null when unlimited) and `bulkImports` (the allowance).
- New actions:
  - `extract`: text → `{bulkRows, bulkTruncated}` or `fail(status, {bulkError})`
  - `bulkAdd`: `rows` JSON → `{bulkResults}`
- `parseBulkRows` validates the posted JSON: it must be an array of `{name, email}` strings, at most 200 rows.
- **Check:** both actions are under the `(app)` auth guard and use `locals`' therapist id. Nothing is taken from the form.

### `src/routes/webhooks/resend/+server.ts` (new, public endpoint)
- Reads the raw body and verifies the signature. A bad signature gets a 400.
- On `email.bounced` with `bounce.type === 'Permanent'`, it calls `markInviteBounced`.
- It returns 200 for everything else, so Resend doesn't retry.
- **Check:** this is a new unauthenticated route. Its only protection is the signature, so make sure the secret is set in prod.

### `src/routes/(portal)/portal/calendar/+page.server.ts`
- `load` also returns `inactive`.
- The `client_inactive` booking error now says "You can't book with your practitioner for the time being. You'll be able to book soon."
- The server-side booking refusal for inactive clients was already in place. This only changes the message and the flag.

### Tests
- `tests/unit/bulkClientRows.test.ts`: covers `flagRows` (passing).
- `tests/integration/bulkClients.test.ts` (not run yet, see step 4):
  - 40 rows on free gives 10 active and 30 inactive
  - 70 rows hits the 50-inactive limit
  - flagged rows are skipped
  - a single add still refuses at the cap
  - paused → active doesn't reactivate an over-cap client
  - 3 imports a month, and an AI failure doesn't count
  - paid plans are unlimited
  - text limits
- `tests/integration/resendWebhook.test.ts` (not run yet):
  - a bad signature gets a 400
  - a permanent bounce flags the client
  - soft bounces and bounces of an old invite are ignored
  - other events get a 200
  - a resend clears the flag

---

## Frontend

### `src/routes/(app)/clients/+page.svelte`
- An "Add many" button sits next to "+ Add client".
- New badge and label:
  - a citrus `inactive` badge, shown when `deactivatedAt` is set and the status isn't `left`
  - a red "Invite bounced — check the email" label in place of "Invite pending"
- Passes `activeCount`, `existingEmails`, the limit, and the allowance into the dialog.

### `src/lib/components/Clients/BulkAddClients.svelte` (new)
- The dialog has three steps: paste → review → results.
- Paste step:
  - shows the character count warning
  - shows "N imports left this month" on the free plan, and disables the button when none are left
- Review step:
  - editable rows, with flags recomputed live
  - the over-cap notice: "Only N will be active… the other M will still be invited, but they'll be inactive and can't book…"
  - the submit button only counts unflagged rows
- **Check:** the notice wording and the mobile layout.

### `src/lib/components/Clients/BulkClientRow.svelte` (new)
- One editable row: name, email, a remove button, and its flag labels. The fields stack on phones.

### `src/lib/components/Clients/BulkAddResults.svelte` (new)
- Shows counts (added, inactive, skipped, not added), lists the rows that weren't added and why, and copyable invite links for any emails that failed to send.

### `src/routes/(portal)/portal/calendar/+page.svelte`
- Inactive clients see the "can't book for the time being" banner instead of the month grid. Rescheduling an existing appointment still shows the grid.
- Per the privacy rule, the banner doesn't say *why* they can't book.

### `src/routes/privacy/+page.svelte`
- The "How we use AI" section now mentions the bulk import: the pasted list goes to the AI, only to extract names and emails.
- The processor list now says OpenRouter receives the pasted list for a bulk import, and Resend reports bounces back to us.
- **Check:** you're happy with the legal wording.

---

## Known limitations (not built)

- **No email editing on a client.** A bounced invite can only be fixed by deleting the client and re-adding them, or by resending if the address was actually fine.
- **Soft bounces and spam complaints are ignored.** Only permanent bounces are flagged.
- `listClients` sends full client rows, now including `inviteEmailId`, to the therapist's browser. That's the existing pattern and the id isn't sensitive, but it could be trimmed.
