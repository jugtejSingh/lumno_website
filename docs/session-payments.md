# Direct session payments via Razorpay Route — plan

Today a client sees unpaid invoices in the portal and pays the therapist
off-platform (UPI, bank transfer, cash); the therapist then flips the
`payment` row with `setPaymentStatus(...'paid')`. This plan lets the client
pay **inside the portal**, with the money going straight to the therapist's
own account — the platform only routes it.

## Why Route (not plain Checkout)

The platform's Razorpay account is the merchant of record. Route lets it
collect a payment and settle it to the therapist's **linked account**
(`acc_…`) in the same transaction. Without Route the money would land in the
platform's account and need manual payout.

Constraints Route imposes:

- **INR only.** Gate the whole feature on `therapist.currency === 'INR'`.
- Each therapist needs an activated linked account before they can be paid.

## Phase 0 — therapist linked account

New column: `therapist.razorpayAccountId text` (nullable).

MVP onboarding (lazy): a "Payouts" section in settings where the therapist
pastes the `acc_…` id of a Route account they created in the Razorpay
dashboard. Server calls `GET /v2/accounts/{id}`, checks
`activation_status === 'activated'`, stores the id. "Pay now" is hidden until
this is set.

```
// ponytail: paste-and-verify now. Full programmatic onboarding
// (POST /v2/accounts + stakeholders + product config + KYC) later,
// once we know therapists won't just do it in the dashboard.
```

No `payoutsEnabled` flag — `razorpayAccountId != null` *is* the flag, same as
packs deriving "active" from status.

## Phase 1 — pay a single invoice

### Schema (`payments.schema.ts`, then `npm run db:push`)

Add to `payment`:

- `razorpayOrderId text` (unique, nullable) — set when checkout starts
- `razorpayPaymentId text` (nullable) — set by the webhook
- `paidVia text` — `'manual'` (default) | `'razorpay'`

No new registry table: the order id lives on the `payment` row it pays, so a
lost webhook is reconcilable by polling `GET /v1/orders/{id}` for that row.
(Subscriptions still use their own path — see
`project_razorpay_checkout_registry` — this is the one-off-payment case and
the row is the natural home.)

### Server: create order

`src/lib/server/razorpay.ts` — new `createSessionOrder`:

```ts
export async function createSessionOrder(params: {
  amountMinor: number;        // whole rupees * 100
  linkedAccountId: string;
  paymentId: string;
}) {
  return razorpay().orders.create({
    amount: params.amountMinor,
    currency: 'INR',
    notes: { paymentId: params.paymentId },
    transfers: [
      {
        account: params.linkedAccountId,
        amount: params.amountMinor, // 100% today; subtract commission here later
        currency: 'INR',
        on_hold: false              // release at settlement, no session-completion hold
      }
    ]
  });
}
```

### Route: `POST` action `payNow` in `(portal)/portal/+page.server.ts`

1. `event.locals.clientId` required.
2. Load the `payment` row by posted `paymentId`; must be this client's,
   `status === 'unpaid'`, `paidVia === 'manual'`.
3. Load therapist: must have `razorpayAccountId` and `currency === 'INR'`.
4. If the row already has a fresh `razorpayOrderId` (created < ~15 min ago,
   still unpaid), reuse it — mirrors `createOrReusePendingSub`'s dedup intent
   without the sentinel machinery (a stale order just expires on Razorpay).
5. Else `createSessionOrder(...)`, write `razorpayOrderId` onto the row.
6. Return `{ orderId, key: env.RAZORPAY_KEY_ID, amountMinor }`.

### Client: checkout

Reuse the `loadCheckoutScript()` helper pattern from
`routes/pricing/+page.svelte`. `new window.Razorpay({ key, order_id, name,
handler })`; `handler` shows "payment processing" — the real flip is the
webhook, same as the subscription flow.

### Webhook: `src/routes/webhooks/razorpay/+server.ts`

Add a branch before the subscription branches:

- Events: `payment.captured` (and/or `order.paid`). Enable them in the
  Razorpay dashboard webhook config — same endpoint, same secret.
- Signature check already covers it.
- `payload.payload.payment.entity` gives `order_id`, `id`, `amount`. Read
  `notes.paymentId` (set it on the *order*; it propagates), or look the
  `payment` row up by `razorpayOrderId`.
- Idempotency: reuse the `razorpay_event` insert-on-conflict-do-nothing guard
  (the `signature` unique index already dedups replays). The subscription
  fields on that row are all nullable, so a payment event slots in fine.
- On first sight: `setPaymentStatus(therapistId, paymentId, 'paid')` +
  set `razorpayPaymentId`, `paidVia = 'razorpay'`. Return 200.
- Guard: if the row is already `paid`, no-op 200.

Refactor note: the current handler is subscription-shaped
(`ACTIVE_EVENTS` etc.). Split the payment path into its own
`handleSessionPaymentCaptured` in `billing.ts` (or a new
`sessionPayments.ts`) rather than widening `handleWebhookEvent`.

## Phase 2 — pay for a pack

Same flow, second action `payPack`: order for `pack.amount`, webhook calls
`markPackPaid(therapistId, packId)`. Deferred until Phase 1 is in use.

## Explicitly out of scope

- **Refunds / partial refunds** — therapist does these from the Razorpay
  dashboard; we don't mirror them back to `payment.status` yet.
- **Platform commission** — the `transfers[].amount` line is where it goes;
  0% for now.
- **Programmatic linked-account onboarding** — see Phase 0 ponytail note.
- **Pay-at-booking** (charge before the slot is confirmed) — current booking
  flow only checks `hasOutstandingBalance`; keep that, don't gate booking on
  a live payment.

## Files, in order

1. `src/lib/server/db/users.schema.ts` — `therapist.razorpayAccountId`
2. `src/lib/server/db/payments.schema.ts` — 3 columns on `payment`; then
   `npm run db:push`
3. `src/lib/server/razorpay.ts` — `createSessionOrder`, an account-verify
   helper
4. `src/lib/server/sessionPayments.ts` — `startCheckout` (order create +
   dedup), `handleSessionPaymentCaptured`
5. `src/routes/(app)/settings/+page.server.ts` + `+page.svelte` — paste &
   verify `acc_…`
6. `src/routes/(portal)/portal/+page.server.ts` + `+page.svelte` — `payNow`
   action + "Pay now" button on unpaid invoices
7. `src/routes/webhooks/razorpay/+server.ts` — `payment.captured` branch
8. Razorpay dashboard — create Route account, enable `payment.captured`
   webhook event
9. `tests/integration/` — order-create dedup, webhook marks paid once
   (idempotent), non-INR therapist blocked

## Open questions

- One platform Route account, or does each therapist onboard as a fully
  separate merchant? Plan assumes **one platform account + linked accounts**.
- Hold transfers until the session is marked `completed` (`on_hold: true` +
  release later), or settle immediately? Plan assumes **immediate** —
  revisit if chargeback risk shows up.
- Who absorbs Razorpay's ~2% MDR — therapist (net less) or add it on top of
  the invoice amount the client sees? Plan assumes **therapist absorbs**
  (transfer = full invoice, fee comes out of the platform settlement, so
  actually the platform absorbs it unless we reduce the transfer). Decide
  before Phase 1.