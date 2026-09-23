# Bugs

Found 2026-09-23. `svelte-check`: 0 errors, 5 warnings. `eslint`: 4 errors. Unit tests: 30/30 passing. Integration tests not run.

First pass covered the pending git diff (uncommitted changes). Second pass swept the rest of the app: auth/sessions, billing/Razorpay, calendar/scheduling/cron, clients/resources/organizations, frontend components not in the diff, and DB schema/layouts/shared utils.

## Real bugs

3. **A failed chat question stays in the history.** `src/lib/components/Notes/ClientNotesChat.svelte`, `askSubmit`.
   The question is added to the chat before the reply comes back and isn't removed if the request fails. The next request then carries two questions in a row with no answer between them, and the failed question is sent to the AI again as context.

4. **The clients list jumps back to page 1 after any action.** `src/routes/(app)/clients/+page.svelte:45`.
   The `$effect` depends on `filtered`, which is recalculated from `data.clients`. Any page reload after an action, not just typing in search, resets you to page 1.

5. **The notes page doesn't reset to page 1 when you come back from the editor.** `src/routes/(app)/notes/+page.svelte:42`.
   The comment says it does, but the `$effect` only depends on `selectedId`, so only switching clients resets the pages.

## Auth & sessions

11. **A session with neither a therapist row nor a client row redirects forever.** `src/hooks.server.ts` and `src/routes/(portal)/+layout.server.ts`.
    The `(app)` group sends anyone without `locals.therapistId` to `/portal`; the `(portal)` group sends anyone without `locals.clientId` to `/dashboard`. If a logged-in user has neither (e.g. a therapist deletes a client while that client still holds a valid session cookie), the two guards bounce the browser between `/dashboard` and `/portal` forever instead of showing an error or logging them out.

12. **The Google OAuth callback defaults to creating a therapist account if the `role` param isn't exactly `Client`.** `src/routes/login/google/callback/+page.server.ts`.
    The login page's own comment says the round-trip `role` param exists so the callback "never provisions a therapist profile for someone who picked Client." But the callback only checks for `role === 'Client'`; anything else (stripped param, mangled URL, replayed link) falls through to auto-creating a therapist profile, silently giving a would-be client a therapist account.

13. **Signing in creates a real session before checking the picked role has a matching profile.** `src/routes/login/+page.server.ts`.
    `signInEmail` logs the user in first; only afterward does it check whether the selected role (therapist/client) actually exists for that account, and fails with a 403 if not — but the session/cookie is already live. Reloading `/login` after that "failure" hits the role-agnostic `load` redirect and silently sends the user into whichever role they *do* have, contradicting the error message they were just shown.

## Frontend components

14. **The new holiday toggle's visual "on" state is backwards.** `src/lib/components/SlotDesigner/HolidayToggle.svelte`.
    Not-a-holiday (bookable) shows the bright, filled track with the dot pushed to the right — which normally reads as "on" — while "Holiday" shows the dim track with the dot at the left. Anyone scanning the switch's look instead of the small text label will misread which state is active.

15. **A bad max-sessions value silently becomes "no limit" instead of showing a validation error.** `src/lib/components/SlotDesigner/MaxSessionsInput.svelte`.
    `Number(raw)` on non-numeric input (pasted text, a stray `-`) produces `NaN`. Nothing downstream catches that; `JSON.stringify(NaN)` serializes to `null`, so on save it's read as "no cap" instead of the "must be a whole number 1–50" error the server enforces for genuinely out-of-range integers.

16. **Reopening "Add charge" for a different client can pre-select the last client.** `src/lib/components/Payments/AddChargeDialog.svelte`.
    The dialog's `$effect` resets the custom-name fields on open but never resets `clientName`/`clientId`. Since the component stays mounted across opens, picking a client, closing without saving, then reopening for someone else leaves the previous client selected instead of defaulting to the first client.

17. **Switching clients in the payments dialog briefly shows the previous client's totals.** `src/lib/components/Payments/ClientPaymentsDialog.svelte` / `PaymentHistoryList.svelte`.
    `totals` only updates once the new client's payment history fetch resolves; it isn't cleared synchronously when `clientId` changes, so the Owed/Paid numbers from whoever was open before flash briefly for the new client.

## Billing & payments

18. **A slow Razorpay checkout can have its pending subscription slot stolen.** `src/lib/server/billing.ts`, `claimPendingSlot`.
    The staleness check only looks at `pendingSince` age (60s), not whether the current `pendingSubId` is still the creating sentinel. A legitimate pending subscription older than 60 seconds (user still on Razorpay's OTP/redirect flow) can be reclaimed by a concurrent `/subscribe` call. When the original `active` webhook finally arrives, it matches neither the live nor the new pending id and is dropped — the user is charged but never upgraded.

19. **A cancelled subscription doesn't keep its plan name, contradicting the code comment.** `src/lib/server/billing.ts` (`TIER_NAMES` comment) vs. the webhook handler and `settings/+page.svelte`.
    The comment says the plan name is retained for both `past_due` and `cancelled`, but cancellation resets `plan: 0`, so the settings page shows "Free" for a cancelled account instead of the plan it had.

20. **A stuck Razorpay token refresh can hang requests indefinitely.** `src/lib/server/razorpayConnection.ts`, `getAccessToken`.
    When the refresh lease is held, it recurses via `sleep` + `getAccessToken` with no retry limit or timeout. If the refresh holding the lease never completes (crash, stuck request), every concurrent checkout for that therapist waits forever instead of failing.

21. **Reconnecting a different Razorpay account overwrites the old one before the "are you sure" step.** `src/routes/(app)/settings/payments/connect/callback/+server.ts`.
    `storeConnection` saves the new OAuth tokens/account unconditionally, then redirects with `?payments=account_changed`. The comment frames this as "a conscious choice, not a silent swap," but the swap has already happened by the time the notice appears — there's no actual confirmation gate.

22. **A fractional charge amount isn't rejected, just silently mangled.** `src/routes/(app)/payments/+page.server.ts`, `parseAmount`.
    Validation only checks `Number.isFinite(amount) && amount >= 1`, never that it's a whole number. `payment.amount` is an integer column, so entering e.g. `45.50` passes validation and gets truncated/rounded by the DB driver instead of showing a clear error.

## Calendar, scheduling & cron

23. **The reminders cron endpoint is unauthenticated if `CRON_SECRET` is unset.** `src/routes/api/cron/reminders/+server.ts:6`.
    `authHeader !== \`Bearer ${'{'}env.CRON_SECRET{'}'}\`` compares against the literal string `"Bearer undefined"` when the env var isn't configured. Anyone who sends `Authorization: Bearer undefined` can trigger all four cron jobs (session reminders, payment reminders, Razorpay reconnect refresh, stale order sweep) on demand.

24. **A bad `?month=` link silently breaks the calendar and booking pages instead of falling back to the current month.** `src/routes/(app)/calendar/+page.server.ts:100`, `src/routes/(portal)/portal/+page.server.ts:56`.
    `year` falls back with `Number(...) || now.getFullYear()`, which also catches `NaN`. `month` uses `Number(searchParams.get('month') ?? now.getMonth())` — `??` only catches `null`/`undefined`, not `NaN`, so a non-numeric `month` value (bad bookmark, hand-edited URL) becomes `NaN` and quietly produces an empty/broken month view instead of defaulting like `year` does.

## Clients, resources & organizations

25. **Two concurrent invite-acceptance requests can race and orphan an account.** `src/lib/server/clients.ts`, `linkClientToUser`.
    `getInviteByToken` checks `client.userId` is null when the invite link is *read*, but the later `UPDATE ... SET userId = ...` has no `WHERE userId IS NULL` guard, and there's no DB unique constraint on `client.userId` either. Two concurrent accept requests (double-submit, two tabs) can both pass the read-time check; whichever write lands last silently becomes the owner, and the other account ends up with no client attached and no error shown.

26. **Opening a therapist-upgrade link twice at once can throw a raw 500 instead of a clean message.** `src/lib/server/therapistUpgrade.ts`, `completeTherapistUpgrade`.
    Reads the verification row, deletes it, then creates the therapist profile — no transaction/lock around the read-delete-create. Two concurrent requests can both read the row before either deletes it and both try to create a profile. The schema's `therapist.userId` unique constraint stops a duplicate row, but the losing request gets an unhandled constraint-violation error rather than "you're already upgraded."

27. **Referral search treats `%` and `_` in the query as wildcards.** `src/lib/server/referrals.ts`, `listReferralTherapists`.
    The `q` param goes into an `ILIKE` pattern unescaped. Searching for a literal `%` or `_` (e.g. "50%") matches unrelated results instead of that literal text. Not a security issue (still parameterized), just wrong search results.

28. **`getReferralProfile` throws instead of failing cleanly if the therapist row is ever missing.** `src/lib/server/referrals.ts`.
    `const [row] = await db.select()...` is used with no undefined check before reading `row.name`. Shouldn't happen in the normal logged-in-therapist path, but there's nothing defending against it.

29. **`createOrganization` is fully built and never called from anywhere.** `src/lib/server/organizations.ts`.
    The whole "create a practice" flow (checks for an existing org, checks no active personal subscription, transactionally creates the org and links the therapist) has zero callers in the codebase — no route, action, or button reaches it. Confusing dead code: either it's a half-shipped feature or leftover from a removed one.

## Layouts, schema & utils

30. **The therapist sidebar shows a hardcoded fake name, not the logged-in therapist's.** `src/routes/(app)/+layout.svelte`.
    `<Avatar name="Dana Reyes" />` is a literal placeholder. Every therapist sees the same name/initials in the header regardless of who's actually logged in, even though `therapist`/`user` data is already loaded and used elsewhere on the page.

31. **The client portal header shows a hardcoded fake name, same bug on the other side.** `src/routes/(portal)/+layout.svelte`.
    `<Avatar name="Maria Chen" size={30} />` is hardcoded even though `data.client.name` is loaded and used by the client switcher right next to it.

32. **`formatCurrency` picks its locale from the server process, not the currency being formatted, and always drops decimals.** `src/lib/format.ts`.
    `Intl.NumberFormat(undefined, ...)` resolves to whatever locale the Node process defaults to during SSR — not necessarily one that matches the therapist's currency — and `maximumFractionDigits: 0` rounds away any fractional amount (e.g. a partial-tier cancellation fee) wherever it's displayed.

33. **A phone number made entirely of punctuation passes validation.** `src/lib/phone.ts`, `PHONE_RE`.
    `/^\+?[\d\s()-]{7,20}$/` only checks the string is 7–20 characters from an allowed set — it never requires even one digit. `"-------"` (7 hyphens) is accepted, contradicting the "7–20 digits" error message shown when it's rejected for the wrong reason.

34. **Editing a note doesn't update any timestamp.** `src/lib/server/db/notes.schema.ts` / `src/lib/server/notes.ts`, `updateNote`.
    `clientNote` has no `updatedAt` column, so an edited note is indistinguishable from an untouched one, and its place in newest-first ordering never reflects the edit.

## Confusing / dead code

35. **A leftover SvelteKit demo `task` table still lives in the schema.** `src/lib/server/db/schema.ts`.
    An unreferenced `task` table (`id`, `title`, `priority`) from the starter template is still defined and would still get pushed to the database.

36. **A fully-built "rebook reminder" feature is wired into the schema but never used.** `src/lib/server/db/users.schema.ts`.
    `client.rebookReminderStage` and `lastRebookReminderAt` are defined and documented (there's even a `docs/rebook-reminders-plan.md`), but nothing in `src` reads or writes either column — a half-shipped feature that silently does nothing right now.

## Worth checking

6. **"Notes overdue" on the dashboard now counts only this week.** `src/routes/(app)/dashboard/+page.server.ts`, `listNotesOverdueThisWeek`.
   Completed sessions from last week that still have no note have dropped out of the count. If that wasn't intended, it's a regression.

7. **Confirmed by actually running it: `db:push` fails to apply the primary-key reorder, and the failure is silently swallowed.** `src/lib/server/db/appointments.schema.ts` (the `availabilityDateOverride` PK), reproduced via `npx vitest run --project integration`.
   Running the integration suite's global setup (which does `drizzle-kit push --force` against the test DB) throws a real Postgres error every time: `cannot drop constraint availability_date_override_therapist_id_date_pk ... because other objects depend on it` (the `availabilitySlot_override_fk` foreign key depends on it), and drizzle-kit doesn't add `CASCADE`. So the PK column reorder this diff makes — the one the code comment says is "pinned so the reorder doesn't rename it" — can never actually apply on a database that already has the old column order; `db:push` needs `DROP ... CASCADE` or a different approach to succeed at all.
   Worse: `execSync(...)` in `tests/integration/global-setup.ts` uses `{ stdio: 'inherit' }` and doesn't check the exit code — despite this fatal error being printed, the process exits 0, setup continues, and all 265 integration tests report passing. The same would happen for a real `npm run db:push` run: the therapist would see the scary Postgres error scroll by but nothing tells them the push as a whole failed, and other unrelated statements in the same push (e.g. adding `weekly_holidays`) still get applied, leaving the schema in a partially-migrated state with no clear signal.

8. **Drafting a client version of a note replaces whatever is open in the editor, without asking.** `src/routes/(app)/notes/+page.svelte`, `shareNoteSubmit`.
   If you click "Send to client" while writing another note, that unsaved text is lost.

9. **The dashboard's "Notes overdue" dialog is read-only.** `src/routes/(app)/dashboard/+page.svelte`.
   Clicking the stat card lists who's missing a note, but each row is plain text — no link to that client's notes. You still have to leave the dialog and find them yourself in the Notes page.

10. **The guide is now one step at a time, but the contents list still looks like same-page anchor links.** `src/routes/(app)/guide/+page.svelte`, `GuideToc.svelte`.
    Only the active section is in the DOM; the rest don't exist until you navigate to them. Clicking a Contents entry changes the hash and (via `activeIndex`) swaps in the right section, but if the browser tries to scroll to `#id` before Svelte re-renders, there's nothing there yet to scroll to. Worth clicking through the TOC to confirm it always lands correctly rather than just silently not scrolling.

## Lint and warnings (not functional bugs)

- ESLint reports 4 errors:
  - `DaySlotsEditor.svelte:39`: `_` is never used.
  - `clients/+page.svelte:44` and `notes/+page.svelte:44`: bare `filtered;` and `selectedId;` lines inside `$effect`.
  - `notes/+page.svelte:161`: a plain `Set` where it wants `SvelteSet`. This one is fine because the set is always replaced, never changed in place.
  - (The `ClientNotesChat.svelte` `{#each}`-with-no-key error from an earlier pass is fixed — it's keyed on index now.)
- Svelte check gives 5 warnings:
  - `saveForm` in `notes/+page.svelte` isn't declared with `$state`. It works but triggers the warning.
  - `scrollEl` in `ClientNotesChat.svelte` isn't declared with `$state` either — same non-issue, it's a `bind:this` element ref only ever read/written imperatively.
  - `StatCard.svelte:14` has a `tabindex` that's only ever nonnegative when the card is actually clickable (`onclick` is set), so this is a static-analysis false positive, not a real accessibility bug.
  - `portal/+page.svelte:23-24` copies `data` once when it loads. The code comment says this is intentional.

## Checked and fine

- Holidays are applied on every path that reads availability: booking (`availability.ts`), schedule (`schedule.ts`) and the calendar.
- Saving the weekly slots validates `holiday` on the server.
- The chat is keyed per client, so one client's history can't leak into another's.
- The notes lookup is limited to the logged-in therapist.
