# Billing & Organizations — how the subscription system works

_Reference doc. Last updated 2026-09-01. Source of truth is the code. Modelled on
edvion's payment system (`edvion/docs/payments.md`) — same Razorpay Subscriptions
design, adapted to therapists + practices instead of one user tier._

Provider: **Razorpay Subscriptions** (recurring mandates — UPI AutoPay and
cards). India-only (`therapist.currency` defaults to `INR`).

---

## Status

**Built:** `subscription` + `organization` schema; `billing.ts`
(`getEffectivePlan`, `usageLimit`, `orgHasFreeSeat`, `THERAPIST_PLAN_USAGE`,
`ORG_PLANS`); `razorpay.ts` (client, plan-number ⇄ plan-id mapping,
`createSubscription`, `cancelSubscription`, `verifyWebhookSignature`);
`createOrganization` (must be reworked, §Organizations).

**Not built** — everything else here: the `/subscribe` `/cancel` `/webhooks`
`/reconcile` routes, the `razorpay_checkout` and `razorpay_webhook_event`
tables, `client.deactivatedAt`, `applyFreeTierDowngrade`, org admin UI, the
cancel button, and wiring `usageLimit()` into `addClient` / booking. Until the
webhook exists no `subscription` row is written and everyone resolves to free.

---

## Principles

- **Razorpay owns the schedule and the money.** It charges the mandate on its
  own clock and reports the outcome via **webhooks**. We never "charge now".
- **`subscription` is a local projection** — one row per holder, written only by
  the webhook handler (plus the org-create transaction).
- **`status` is the only access gate.** Not `currentEnd`, not `plan`.
- **Trust signature-verified fields only.** The webhook's `plan_id` is HMAC-
  verified; `notes` carries `{ holderType, holderId }` and nothing else
  load-bearing.
- **One row per holder** — `subscription_one_holder` check (therapist XOR org),
  unique index on each holder column. Free tier = no row.

## Razorpay subscription mental model

- A subscription = `plan_id` + a customer **mandate**. States: `created` →
  `authenticated` → `active` → `halted` / `cancelled` / `completed` / `expired`.
- The mandate is **frozen at authorization** to one UPI handle / card. **UPI
  AutoPay mandates can't be edited** — every plan / frequency / card change is
  cancel-old + create-new + re-authorize.
- A `created` sub leaves that state only on auth, on cancel, or at `expire_by`
  (→ `expired`, **silently — no webhook**). Set `expire_by = now + 30 min` on
  every create so abandoned checkouts self-clean (`razorpay.ts` doesn't yet).
- `total_count` must be finite; `razorpay.ts` uses `120` (≈ 10 years monthly).

---

## Data model

### `subscription` (`billing.schema.ts`)

| Column | Meaning |
|---|---|
| `therapistId` / `organizationId` | holder — exactly one set, each unique-indexed |
| `plan` | tier number: `0/1/2` therapist, `100/101/102` org |
| `status` | `subscriptionStatusEnum` — **the access gate** |
| `razorpaySubscriptionId` | live sub on Razorpay's side, unique |
| `razorpayCustomerId` | Razorpay customer |
| `currentEnd` | end of paid period — **display only** |

**Columns still to add** (`npm run db:push` — pre-prod, no migrations):

- `cancelAtCycleEnd boolean not null default false` — set by `/cancel`, reset by
  any entitling webhook. UI only.
- `razorpayPlanId text` — exact `plan_id` of the live sub, for "same plan"
  detection in the plan-change flow.
- `lastWebhookAt timestamp` — `created_at` of the last event applied; the
  webhook drops anything older (out-of-order guard).

### `razorpay_webhook_event` (new) — inbound idempotency

`id text primary key` = `X-Razorpay-Event-Id`; `processedAt` default now.
Disposable, prune > 30 days (no job yet).

### `razorpay_checkout` (new) — pending-checkout registry

The only trace of a checkout Razorpay never sent a webhook for. **We deliberately
diverge from edvion here:** edvion parks a `pending_sub_id` + `__creating__`
sentinel *on the subscription row*; we use a separate table and **never write a
`subscription` row (not even a placeholder) at checkout**.

- `razorpaySubscriptionId text primary key`
- `therapistId` / `organizationId` — nullable FKs `onDelete: cascade`, one set
- `plan integer not null`
- `createdAt timestamp not null default now()` — TTL anchor

Written by the checkout action before it returns; deleted by any entitling
webhook and by the reconcile. Never read for entitlement.

### `client` (new columns)

- `deactivatedAt timestamp` — set only by `applyFreeTierDowngrade`, cleared on
  reactivation. While set: not bookable, not counted against
  `usageLimit('clients')`, status dropdown hidden (delete still works).
- `keepOnDowngrade boolean not null default false` — keep-set choice, editable
  only during a cancel-at-cycle-end window. Cleared on reactivation.

---

## Tiers (`billing.ts`)

```
THERAPIST_PLAN_USAGE  0: { clients: 5,   appointmentsPerMonth: 40 }   ← free
                      1: { clients: 50,  appointmentsPerMonth: 400 }
                      2: { clients: ∞,   appointmentsPerMonth: ∞ }

ORG_PLANS           100: { seats: 5,  memberTier: 1 }
                    101: { seats: 10, memberTier: 2 }
                    102: { seats: 20, memberTier: 2 }
```

`THERAPIST_PLAN_USAGE[tier][key]` is the single source of truth for caps.
`Infinity` = no cap; missing key = not allowed (`usageLimit` → `null` → block).

Constants still to add: `FREE_BOOKABLE_CLIENTS` (default 5 —
`THERAPIST_PLAN_USAGE[0].clients`), `UNACTIVATED_SUB_TTL_HOURS = 24`.

**Plan-id mapping** (`razorpay.ts`): `PLAN_ID_ENV` maps plan number → env var.
`planIdFor` (checkout, number → id), `planNumberFor` (webhook, id → number,
throws on unknown → webhook returns 200). Env: `PUBLIC_RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`RAZORPAY_PLAN_ID_{1,2,100,101,102}`, `CRON_SECRET`. No test-mode var scheme
yet (edvion's `_rzp_env` reads `<NAME>_TEST` under `PAYMENT_MODE=testing`).

---

## Entitlement — `getEffectivePlan(therapistId)`

Pure function of stored `subscription.status`. **Never** reads `currentEnd` or
does date math (Razorpay timestamps lag).

1. **Entitled** = `status in ('active','authenticated')` → that row's tier.
   Everything else → free.
2. Therapist in an org: evaluate their own row **and** the org's row, return the
   higher tier. A personal sub bridges the transition into an org; once Razorpay
   marks it non-active the org member tier takes over.
3. No timers, no grace.

**Divergence from edvion:** edvion's `effective_tier` also has a 3-day
`current_period_end` backstop for a dropped terminal webhook. We rely on the
nightly reconcile for that instead, keeping this function pure.

`usageLimit(therapistId, key)` resolves off `getEffectivePlan` live — a status
change takes effect on the next request, no cache.

---

## Endpoints (all unbuilt)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /subscribe` | therapist | Single entry for new sub **and** plan change; server picks which from the row. Returns `{ subscriptionId, keyId }` |
| `POST /cancel` | therapist | Schedule cancel-at-cycle-end. Idempotent |
| `POST /webhooks/razorpay` | Razorpay HMAC | The only writer of `status` / `plan` / `currentEnd` |
| `POST /payment/reconcile` | `X-Cron-Secret` | Nightly sweep |

Org-plan checkout lives inside `createOrganization`, not `/subscribe`.

---

## Flows

### New subscription

1. Therapist picks a plan → `POST /subscribe { plan }`. (Not logged in → stash a
   `pending_plan` cookie, resume after auth.)
2. `/subscribe` reads the holder's row:
   - entitled sub → **plan change** (below).
   - mid-lifecycle (`created` / `pending`) → `409 subscription_in_progress`.
   - `halted` → cancel it on Razorpay best-effort, then subscribe fresh.
   - none / `cancelled` / `expired` → subscribe fresh.
3. `createSubscription(plan, { holderType, holderId })` → Razorpay
   `subscription_id`. **Same action, before returning: insert the
   `razorpay_checkout` row.**
4. Frontend opens Razorpay Checkout; therapist authorizes the mandate. Callback
   shows "activating…".
5. Razorpay fires `subscription.activated` then `subscription.charged` → webhook
   upserts the row, deletes the checkout row, reactivates clients.

### Plan change (upgrade / downgrade / frequency) — one code path

Reached when the row already has an entitled sub. UPI mandates can't be edited,
so up / down / frequency are all the same:

- Requested plan == `razorpayPlanId` → `422 same_plan`, **unless**
  `cancelAtCycleEnd` is set — then it's a **Resume**, fall through to a fresh
  sub.
- Otherwise: mint a new sub at the target plan now (new `razorpay_checkout`
  row). The current sub **stays the source of truth** until the new sub's first
  `charged` webhook, which upserts the new sub and **cancels the old one on
  Razorpay**.

No undo for a scheduled cancel — Razorpay has no API for it. "Resume" =
resubscribe fresh (new billing anchor).

### Cancel — `POST /cancel`

1. `status == 'cancelled'` → `409`. `cancelAtCycleEnd` already set → `200` no-op.
2. `cancelSubscription(id)` → `subscriptions.cancel(id, true)`.
3. Set `cancelAtCycleEnd = true`, **leave `status = 'active'`** — the holder
   keeps their tier to cycle end.
4. Later, Razorpay fires `subscription.cancelled` / `completed` → webhook sets
   `status`, `plan = 0`, keeps `currentEnd` for display, and runs the downgrade
   (therapist) or disband (org).

UI: while `cancelAtCycleEnd && active` → "Access until {currentEnd}", Cancel
hidden, Resubscribe shown, keep-set picker available.

### Payment failure

Razorpay retries on its own dunning schedule (days–weeks, its own emails), fires
`subscription.pending` then `subscription.halted`; it does **not** auto-cancel.
`subscriptionStatusEnum` has `halted` / `pending` (no `past_due`) — store
verbatim and **keep `plan`** so the UI shows "Pro — payment failed" and a
successful retry restores the tier. `getEffectivePlan` returns free while
`halted` → access cut → downgrade (therapist) / disband (org).

Recovery = **resubscribe** (`/subscribe` on a `halted` row cancels it and mints
a fresh sub). No "pay the old invoice" — the mandate can't be rebound, so
resubscribe is also the change-card flow.

---

## Webhook — `POST /webhooks/razorpay`

Verify → three gates → dispatch, all in **one transaction**. A throw after the
gates rolls back the idempotency row too, so Razorpay's retry reprocesses
cleanly. Read the **raw** body before parsing (signature needs it).

**Gates:**

1. **Dedup** — `INSERT razorpay_webhook_event (id = X-Razorpay-Event-Id) ON
   CONFLICT DO NOTHING RETURNING id`. No row → `200`.
2. **Stale drop** — `event.created_at < subscription.lastWebhookAt` → store
   nothing, `200`. Equal timestamps pass.
3. **Unknown sub** — terminal event, looked up by `razorpaySubscriptionId`, no
   row → `200` no-op. (Entitling events resolve the holder from `notes` and may
   have no row yet.)

No `notes.holderId` → `200` and ignore.

**Dispatch** — tier always from the signature-verified `plan_id`:

| Event(s) | Action |
|---|---|
| `activated` / `authenticated` / `charged` / `resumed` | **Entitled.** Upsert row (`razorpaySubscriptionId`, `razorpayPlanId`, `plan`, `status`, `currentEnd`, `cancelAtCycleEnd = false`, `lastWebhookAt`). Delete the `razorpay_checkout` row. If a different live sub was replaced → cancel it on Razorpay. Reactivate clients. |
| `halted` / `pending` | Store `status`, **keep `plan`**. Therapist → downgrade, org → disband. |
| `cancelled` / `completed` | Store `status`, `plan = 0`, keep `currentEnd`, clear `cancelAtCycleEnd`. Therapist → downgrade, org → disband. |
| anything else | logged, ignored. |

Every handler is re-run-safe (same payload; reactivation, downgrade, disband all
no-op the second time).

**Create-side dedup gap:** we write no `subscription` row at checkout, so
nothing serialises concurrent `subscriptions.create` calls. A double-click can
mint two subs; `expire_by` cleans the unauthenticated one → zero double charges.
Same residual gap edvion documents (Razorpay has no idempotency key for
Subscriptions).

---

## Organizations

**No org without a paid org plan** — no free-tier org, no "create now pay
later". Only entry is org-plan checkout.

Shared rule for join / create / leave: **any active personal sub is scheduled
for cancel-at-cycle-end**, the higher of the two tiers applies until it lapses,
and it is **not** un-scheduled if you later leave (Razorpay can't reverse it).
The §Free-tier downgrade runs only if the new tier's client cap is actually
exceeded.

### Creating — `createOrganization()` needs rework

Today: inserts org + sets `organizationId` in one tx, rejects a caller holding a
personal sub. Rework to:

- Precondition: therapist, not already in an org (`already_in_org`). Personal
  sub is now fine.
- Org plan → org-plan Razorpay Checkout (holder = new org), `razorpay_checkout`
  row inserted.
- On checkout success, one tx: insert `organization`, insert `subscription`
  (`status = 'created'`, holder = org), set owner's `organizationId`, schedule
  the owner's personal sub for cancel-at-cycle-end.
- Entitled once `subscription.activated` lands.

### Joining / Leaving

- **Join:** admin invites; on accept `orgHasFreeSeat(orgId)` else `no_seat`; set
  `organizationId`; recompute to the org member tier.
- **Leave:** from Settings any time; `organizationId = null`; recompute to the
  personal sub (a not-yet-lapsed cancel-scheduled one still counts) else free.
- **Owner** can't leave with members present: remove everyone, or transfer
  ownership (`ownerTherapistId` → a member; `onDelete: restrict` is the
  backstop). Open question: how a swapped-in owner supplies billing details.

Front-end copy (join & leave, same shape): *"Joining {org} puts you on their
plan. Any personal subscription is cancelled at the end of its current cycle —
you keep your current features until then. If the new plan allows fewer clients
than you have, the extras are deactivated (kept as records; re-subscribing
brings them back)."*

### Disband — `disbandOrganization(orgId)`

Fires the moment the org's sub leaves the entitled bucket (`cancelled` or
`halted`) — same event, no grace. One tx: delete the `organization` row →
members auto-detach (`organizationId` `set null`), the org's `subscription` and
`razorpay_checkout` rows cascade. Per ex-member (owner included): recompute to
their personal sub if still entitled, else free → downgrade.

- Halt-triggered: members get no notice (owner's card, not theirs).
- Cancel-triggered: the owner had the whole cycle to warn members.
- Owner fixes the card first → `charged` / `resumed` → no disband.
- No "disbanded but recoverable" — re-forming means a new org.

If the first charge never lands, reconcile Pass B deletes an org whose only sub
is still `created` after `UNACTIVATED_SUB_TTL_HOURS`.

---

## Free-tier downgrade

On dropping to free, only `FREE_BOOKABLE_CLIENTS` clients stay active; the rest
get `deactivatedAt` set — data kept, not bookable, not counted. Fully
reversible.

### `applyFreeTierDowngrade(therapistId)` — idempotent

1. `activeClientCount <= FREE_BOOKABLE_CLIENTS` → nothing to do. This
   short-circuit makes every caller safe to fire uncoordinated.
2. Keep set: therapist's `keepOnDowngrade` flags, else recency (last appointment
   activity, fall back to `createdAt`).
3. Every active client not in the keep set → `deactivatedAt = now()`.
4. Cancel those clients' future appointments (best-effort Google Calendar
   delete), once, here.

**Callers** (all immediate): webhook `halted` / `cancelled` for a therapist
holder; org disband; leaving an org with no active personal sub; the nightly
reconcile; a lazy check on dashboard / clients load (`getEffectivePlan` free
**and** `activeClientCount > FREE_BOOKABLE_CLIENTS`).

### After deactivation

- Excluded from the active-client count, `usageLimit('clients')`, and portal
  booking (`createAppointmentForClient` → `error: 'client_inactive'`; portal
  copy *"Booking with this therapist is closed. Please contact them directly."*).
- Client list: "Deactivated" group — notes / payments / past appts still
  viewable, no status dropdown, delete still works.
- Dashboard banner: *cancel pending* → "Your plan ends on {currentEnd}. {n}
  clients above the free limit will be deactivated then. Choose who to keep.";
  *already downgraded* → "Your plan has ended. {n} clients are deactivated —
  re-subscribe to reactivate them."

### Reactivation

On any entitling webhook / reconcile seeing the holder entitled again:
`UPDATE client SET deactivatedAt = NULL, keepOnDowngrade = false WHERE <holder's
clients> AND deactivatedAt IS NOT NULL` — **every** deactivated client,
unconditionally, even past the new tier's cap. `usageLimit` still blocks
*adding* clients until they're back under; nobody is re-deactivated; the
therapist picks who to drop. Cancelled appointments are not recreated; clients
deleted while deactivated stay gone.

### Keep-set picker

Shown only during a cancel-at-cycle-end window. Writes `keepOnDowngrade`; if
fewer than `FREE_BOOKABLE_CLIENTS` are flagged, `applyFreeTierDowngrade` tops up
by recency. Halt and disband are instant — no window, recency default.

---

## Enforcement points (all unwired)

Cap from `usageLimit(therapistId, key)` (number, or `null` = block); tier from
`getEffectivePlan` live.

| Resource | Where | Guard |
|---|---|---|
| Add client | `clients.ts` `addClient` | `activeClientCount >= usageLimit(t,'clients')` → `plan_limit` |
| Book appt (portal) | `availability.ts` `createAppointmentForClient` | `client.deactivatedAt` set → `client_inactive` |
| Add org member | org admin action | `!orgHasFreeSeat(orgId)` → `no_seat` |

"Active client" = `status = 'active' AND deactivatedAt IS NULL`. A downgrade
only touches `deactivatedAt`, so a client marked `'left'` stays `'left'`.

---

## Nightly reconcile — `POST /payment/reconcile`

No in-app scheduler. Authenticated endpoint + external cron (Vercel Cron, since
we run `@sveltejs/adapter-vercel`): `vercel.json` →
`{ "crons": [{ "path": "/payment/reconcile", "schedule": "0 */3 * * *" }] }`,
gate on `X-Cron-Secret == env.CRON_SECRET` → else 403.

**Pass A — known subs.** For every non-terminal `subscription` row: `GET
/subscriptions/:id`, compare `status`, apply the webhook's transition on change
(out of entitled → downgrade / disband; back in → reactivate). Writes go
directly to `subscription` (no signature to key on; upsert-by-holder is safe, a
later real webhook still corrects it). try/except per row.

**Pass B — the `razorpay_checkout` registry.** The "paid but no webhook landed"
net. Per row:

1. A `subscription` row already has this `razorpaySubscriptionId` → cleanup
   delete was missed; delete the checkout row.
2. Else `GET /subscriptions/:id`:
   - `active` / `authenticated` / `charged` → run the `activated` transition
     now; delete the checkout row.
   - `created` / `pending` **and** row older than `UNACTIVATED_SUB_TTL_HOURS` →
     never authorised; delete it (org: also delete the still-`created` org, sub
     cascades, clear owner's `organizationId`).
   - `created` / `pending` younger than the TTL → still in flight, leave it.
   - `expired` / `cancelled` / `completed` / `404` → abandoned; delete (org:
     same cleanup).
   - **Razorpay call errored → leave the row, retry next pass.** Never delete on
     an unconfirmed check.

---

## Known limitations / deferred

| Item | State |
|---|---|
| No idempotency key on `subscriptions.create` | Razorpay doesn't offer one; `expire_by` cleans the duplicate → zero double charges |
| No amount / currency check in the webhook | Low risk |
| `razorpay_webhook_event` grows unbounded | No retention job |
| No time backstop in `getEffectivePlan` | Reconcile covers missed terminal webhooks; add the 3-day line if it proves unreliable |
| `subscription.updated` / `paused` not handled | Dashboard-side cancels, unshipped pause. Low value |
| Halt recovery = resubscribe, not pay-the-invoice | Won't-do — UPI mandate can't be rebound |
| No Razorpay test-mode env scheme | Add `<NAME>_TEST` vars if needed |
| Non-therapist org admin | Needs a role on membership, not the owner FK. YAGNI |

---

## Build checklist

- [ ] `npm run db:push` — `subscription` columns, `razorpay_webhook_event`,
      `razorpay_checkout`, `client` columns.
- [ ] `billing.ts` — `FREE_BOOKABLE_CLIENTS`, `UNACTIVATED_SUB_TTL_HOURS`.
- [ ] `razorpay.ts` — `expire_by` on create; store `razorpayPlanId`.
- [ ] `/subscribe` — new-sub + plan-change paths; insert `razorpay_checkout`
      before returning.
- [ ] `/cancel` — `cancelSubscription` + `cancelAtCycleEnd`.
- [ ] `POST /webhooks/razorpay` — raw-body verify + 3 gates + dispatch, one tx.
- [ ] `applyFreeTierDowngrade` + reactivation + portal `client_inactive` +
      "Deactivated" client group + dashboard banners + keep-set picker.
- [ ] Lazy downgrade check on dashboard / clients load.
- [ ] Wire the §Enforcement guards.
- [ ] `createOrganization` rework + `leaveOrganization` + `transferOwnership`;
      drop the invite-accept "no subscription" block.
- [ ] `disbandOrganization(orgId)` — from the webhook and the reconcile.
- [ ] Org admin UI (members list, invite, remove, seat check) + org-wide client
      view.
- [ ] `/payment/reconcile` + `reconcileSubscriptions()` (Pass A + B) +
      `vercel.json` cron + `CRON_SECRET`.
- [ ] Settings billing section — effective vs billed plan, one cancel button.

---

## Testing

Mirror edvion's `test_payment_controller.py`: signature rejection, dedup gate,
stale drop, unknown-sub no-op, promote / retire on plan change, cancel
idempotency, `halted` / `pending` keeping tier, reconcile promoting a
paid-but-no-webhook row, reconcile catching a missed halt / terminal,
`/reconcile` requiring the secret. Plus `getEffectivePlan` (two-bucket +
higher-of-personal-or-org) and `applyFreeTierDowngrade` idempotency +
reactivation.
