# Marketplace Payments via Razorpay Partner OAuth — System Design

**Model:** Razorpay Technology Partner (Pure Platform). Each seller holds their own
Razorpay merchant account. Your platform acts on their behalf via OAuth-scoped tokens.
Customer money settles **directly to the seller's bank account** and never enters your
current account.

---

## 1. Why this solves the ₹40L problem

Under the RBI Payment Aggregator Directions, 2025, a PA may only debit its escrow account
to a third party on a merchant's instruction where the merchant's annual turnover exceeds
₹40 lakh. That rule is what gates Razorpay Route.

In the partner model there is no third-party debit. The seller *is* the merchant of record
for their own transaction. Razorpay's escrow settles to the seller — a first-party
settlement, entirely outside the restricted flow. Your turnover is irrelevant to it.

### How you get paid

| Mechanism | RBI exposure | Notes |
|---|---|---|
| **Partner commission** from Razorpay (share of MDR on sub-merchant volume) | None | Configured by Razorpay at partner level. Cleanest revenue line. |
| **Platform subscription / listing fee** billed by you to the seller | None | Your own invoice, seller pays you directly. Recurring, predictable. |
| **Per-transaction platform fee via `transfers` on the seller's order** | ⚠️ High | This is a Route transfer on the *sub-merchant's* account, debiting their escrow to you. The seller must clear ₹40L **and** you must be the party interfacing with the payer — which you are not. Do not build on this. |

Design for the first two. If you later want per-transaction economics, negotiate a higher
commission share with Razorpay rather than building transfers.

---

## 2. Component architecture

```
                         ┌──────────────────────────────────────┐
   Seller browser ──────▶│  Onboarding Service                  │
                         │  • OAuth initiate / callback         │
                         │  • Sub-merchant account creation     │
                         │  • KYC status polling                │
                         └───────────────┬──────────────────────┘
                                         │ writes
                                         ▼
                         ┌──────────────────────────────────────┐
                         │  Credential Vault                    │◀── KMS
                         │  • encrypted tokens per seller       │
                         │  • single-flight refresh             │
                         │  • expiry scheduler                  │
                         └───────────────┬──────────────────────┘
                                         │ reads (short-lived, in-memory)
                                         ▼
   Buyer browser ───────▶┌──────────────────────────────────────┐
                         │  Order Service                       │────▶ api.razorpay.com
                         │  • create order as sub-merchant      │      (Bearer access_token)
                         │  • hand public_token to Checkout     │
                         │  • verify payment signature          │
                         └──────────────────────────────────────┘

   Razorpay ────────────▶┌──────────────────────────────────────┐
   webhooks              │  Webhook Ingress                     │────▶ Queue ──▶ Workers
                         │  • HMAC verify on raw body           │            • order state
                         │  • dedupe by event id                │            • notifications
                         │  • fast 200, async process           │            • ledger
                         └──────────────────────────────────────┘

                         ┌──────────────────────────────────────┐
                         │  Reconciliation Job (hourly + daily) │
                         │  • sweep payments per sub-merchant   │
                         │  • close orphaned orders             │
                         └──────────────────────────────────────┘
```

Four services, one queue. Resist splitting further until you have volume.

---

## 3. Onboarding flows

Two entry paths depending on whether the seller already banks with Razorpay.

### 3.1 Seller already has a Razorpay account — OAuth import

```
Seller clicks "Connect Razorpay"
   │
   ├─▶ Backend generates state = random(32), stores {state, seller_id, expires_at: +10min}
   │
   ├─▶ 302 to:
   │     https://auth.razorpay.com/authorize
   │       ?client_id=<CLIENT_ID>
   │       &response_type=code
   │       &redirect_uri=https://yourapp.com/oauth/razorpay/callback
   │       &scope[]=read_write
   │       &state=<state>
   │
   ├─▶ Seller approves on Razorpay's consent screen
   │
   ├─▶ Razorpay redirects to redirect_uri?code=...&state=...
   │
   ├─▶ Backend: validate state matches stored value for this seller, then delete it
   │             (single use — reject replays)
   │
   ├─▶ URL-decode the code, then POST https://auth.razorpay.com/token
   │     { client_id, client_secret, grant_type: "authorization_code",
   │       redirect_uri: <same as above>, code: <decoded>, mode: "test"|"live" }
   │
   └─▶ Store: access_token, refresh_token, public_token, razorpay_account_id, expires_in
```

Gotchas that will bite:

- The authorisation code arrives **URL-encoded**. Decode before exchanging, or you get an
  opaque `invalid_grant`.
- `redirect_uri` in the token call must byte-match the one in the authorize URL. Trailing
  slashes count.
- Whitelist every `redirect_uri` in the Partner Dashboard, including localhost variants for
  dev.
- The dev client only works in test mode; the prod client only works in live mode. There is
  no crossover — keep two config sets.

### 3.2 New seller — create the account first

Use the Sub-Merchant Onboarding APIs (`https://api.razorpay.com/v2`, Partner Auth via Basic
auth with your partner key id/secret):

1. `POST /v2/accounts` → returns `account_id` (e.g. `acc_Hbu4sC0O4GOGSN`)
2. `POST /v2/accounts/{id}/stakeholders` → beneficial owner details
3. Upload KYC documents
4. `POST /v2/accounts/{id}/products` → request the `payment_gateway` product, then patch
   configuration (settlement account, accepted methods)
5. Record terms acceptance and transmit it to Razorpay
6. Poll or webhook on activation status
7. Once activated, run the OAuth flow from 3.1 to get tokens

Alternatively the Custom Onboarding SDK bundles account creation and OAuth into one
embedded flow — less control, much less code. Worth using for v1 unless you need a
white-labelled multi-step wizard.

### 3.3 Seller state machine

```
  INVITED
     │ account created
     ▼
  ACCOUNT_CREATED ──────────────┐
     │ KYC submitted            │ rejected
     ▼                          ▼
  KYC_UNDER_REVIEW ────────▶ KYC_REJECTED ──▶ (resubmit) ──┐
     │ approved                                            │
     ▼                                                     │
  KYC_APPROVED                                             │
     │ OAuth consent granted                               │
     ▼                                                     │
  PAYMENTS_LIVE ◀──── reconnect ────┐                      │
     │                              │                      │
     │ authorization_revoked        │                      │
     │ or refresh_token expired     │                      │
     ▼                              │                      │
  PAYMENTS_DISABLED ────────────────┘◀─────────────────────┘
```

Only `PAYMENTS_LIVE` sellers may have orders created against them. Enforce this in the
order service, not just the UI.

---

## 4. Credential vault

This is where the design actually earns its keep. Token lifetimes:

- `access_token` — 90 days
- `refresh_token` — 180 days, **rotates on every use** (the old one dies immediately)
- `public_token` — safe to expose client-side, replaces `key_id` in Checkout
- If the refresh token expires, there is no recovery. The seller must re-consent.

### 4.1 Schema

```sql
CREATE TABLE seller_razorpay_credentials (
  seller_id             UUID PRIMARY KEY REFERENCES sellers(id),
  razorpay_account_id   TEXT NOT NULL,
  mode                  TEXT NOT NULL CHECK (mode IN ('test','live')),

  -- envelope-encrypted; ciphertext only, never plaintext at rest
  access_token_enc      BYTEA NOT NULL,
  refresh_token_enc     BYTEA NOT NULL,
  public_token          TEXT  NOT NULL,   -- not secret
  dek_wrapped           BYTEA NOT NULL,   -- data key wrapped by KMS CMK
  kms_key_id            TEXT  NOT NULL,

  access_expires_at     TIMESTAMPTZ NOT NULL,
  refresh_expires_at    TIMESTAMPTZ NOT NULL,
  scopes                TEXT[] NOT NULL,

  status                TEXT NOT NULL,    -- ACTIVE | REVOKED | REFRESH_FAILED
  refresh_lock_until    TIMESTAMPTZ,      -- single-flight guard
  last_refreshed_at     TIMESTAMPTZ,
  refresh_failure_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON seller_razorpay_credentials (access_expires_at)
  WHERE status = 'ACTIVE';
```

### 4.2 Single-flight refresh

Because the refresh token rotates, two concurrent refreshes will race: one succeeds, the
other burns an already-invalidated token and you permanently lose access to that seller.
This is the single most common way partner integrations break.

```ts
async function getAccessToken(sellerId: string): Promise<string> {
  const cred = await loadCredential(sellerId);

  if (cred.status !== 'ACTIVE') throw new SellerNotConnected(sellerId);

  // Refresh proactively at 80 days, not on expiry.
  const needsRefresh = cred.accessExpiresAt < addDays(now(), 10);
  if (!needsRefresh) return decrypt(cred.accessTokenEnc, cred.dekWrapped);

  // Acquire an exclusive lease. Row-level, so it survives multi-instance deploys.
  const leased = await db.query(`
    UPDATE seller_razorpay_credentials
       SET refresh_lock_until = now() + interval '60 seconds'
     WHERE seller_id = $1
       AND (refresh_lock_until IS NULL OR refresh_lock_until < now())
    RETURNING *`, [sellerId]);

  if (leased.rowCount === 0) {
    // Someone else is refreshing. Back off and re-read rather than racing.
    await sleep(jitter(500, 2000));
    return getAccessToken(sellerId);
  }

  try {
    const res = await postJson('https://auth.razorpay.com/token', {
      client_id:     CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      grant_type:    'refresh_token',
      refresh_token: decrypt(cred.refreshTokenEnc, cred.dekWrapped),
    });

    // Persist BOTH new tokens in one transaction before returning.
    await persistRotatedTokens(sellerId, res);
    return res.access_token;

  } catch (err) {
    await recordRefreshFailure(sellerId, err);
    // 4xx from the token endpoint means the refresh token is dead. No retry will help.
    if (isClientError(err)) {
      await markStatus(sellerId, 'REFRESH_FAILED');
      await notifySellerToReconnect(sellerId);
    }
    throw err;
  } finally {
    await releaseLease(sellerId);
  }
}
```

Additional guards:

- A nightly job scans for `refresh_expires_at < now() + 30 days` and emails those sellers.
  A seller who has not transacted in six months is exactly the one whose token silently
  dies. (This codebase does it differently — see §12.7: a cron proactively refreshes every
  active connection, which rotates the refresh token and slides `refresh_expires_at`
  forward, removing the need for the pre-emptive nag entirely.)
- Alert on `refresh_failure_count > 0` aggregated by day. A spike means a config or clock
  problem, not scattered seller behaviour.
- Never log tokens. Redact `access_token`, `refresh_token`, `code`, and `client_secret` at
  the logger layer, not at each call site.

### 4.3 Encryption

Envelope encryption with AWS KMS (or GCP KMS / Vault transit):

1. Generate a 256-bit data key per credential row, `GenerateDataKey`.
2. AES-256-GCM the token with the plaintext key; store ciphertext + auth tag.
3. Store the KMS-wrapped key in `dek_wrapped`; discard the plaintext key.
4. On read, `Decrypt` the wrapped key, decrypt the token, hold in memory only for the
   duration of the request.

A database dump alone is then useless. Cache decrypted tokens in memory with a short TTL
(60s) if KMS call volume becomes a cost issue — never cache in Redis.

---

## 5. Payment flow

### 5.1 Sequence

```
Buyer                Your API              Razorpay API           Checkout.js
  │                     │                       │                     │
  │──── place order ───▶│                       │                     │
  │                     │ load seller cred      │                     │
  │                     │ getAccessToken()      │                     │
  │                     │                       │                     │
  │                     │── POST /v1/orders ───▶│                     │
  │                     │   Bearer <access>     │                     │
  │                     │◀── order_xxx ─────────│                     │
  │                     │                       │                     │
  │                     │ persist order         │                     │
  │◀─ {order_id,        │  (state=CREATED)      │                     │
  │    public_token} ───│                       │                     │
  │                     │                       │                     │
  │──────────── open checkout with public_token ─────────────────────▶│
  │◀─────────────────── payment UI ───────────────────────────────────│
  │                     │                       │                     │
  │─ razorpay_payment_id, razorpay_signature ──▶│                     │
  │                     │ verify HMAC           │                     │
  │                     │ state=PAID_UNCONFIRMED│                     │
  │◀── success page ────│                       │                     │
  │                     │                       │                     │
  │                  [webhook payment.captured] │                     │
  │                     │◀──────────────────────│                     │
  │                     │ state=CONFIRMED       │                     │
```

### 5.2 Order creation

```ts
const token = await getAccessToken(sellerId);

const order = await fetch('https://api.razorpay.com/v1/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
    'X-Razorpay-Account': undefined,   // NOT needed — the token already scopes the account
  },
  body: JSON.stringify({
    amount:   amountInPaise,           // integer paise. 499.00 → 49900
    currency: 'INR',
    receipt:  internalOrderId,         // your id — the reconciliation anchor
    notes: {
      platform_order_id: internalOrderId,
      seller_id:         sellerId,
      buyer_id:          buyerId,
    },
  }),
});
```

Put your internal ids in `notes` on every single order. When you are reconciling a
three-week-old dispute this is the difference between a query and an afternoon.

### 5.3 Checkout — use the public token

```js
const options = {
  key:      publicToken,        // rzp_live_oauth_XXXX — replaces key_id
  order_id: razorpayOrderId,
  amount:   49900,
  currency: 'INR',
  name:     sellerDisplayName,  // the SELLER's brand, not yours
  handler:  function (response) { postToBackend(response); },
  prefill:  { name, email, contact },
};
new Razorpay(options).open();
```

The `public_token` is designed for client exposure. Your `access_token` must never reach a
browser or a mobile bundle.

### 5.4 Signature verification

Note the subtlety — under OAuth the HMAC key is your **`client_secret`**, not a merchant
`key_secret`:

```ts
import { createHmac, timingSafeEqual } from 'crypto';

function verifyPaymentSignature(orderId, paymentId, signature) {
  const expected = createHmac('sha256', CONFIG.clientSecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Use `orderId` fetched from **your** database keyed by your internal order, not the
`razorpay_order_id` the browser posted back. Otherwise an attacker supplies a matched
triple from their own order and you verify it happily.

`timingSafeEqual` throws on length mismatch, hence the guard.

---

## 6. Webhooks

Treat the browser callback as a hint and webhooks as truth. Buyers close tabs mid-redirect;
the payment still captured.

### 6.1 Events to subscribe

| Event | Action |
|---|---|
| `payment.captured` | Move order to CONFIRMED, release to fulfilment |
| `payment.failed` | Mark attempt failed, allow retry |
| `order.paid` | Cross-check against payment.captured |
| `refund.created` / `refund.processed` | Update refund ledger |
| `account.app.authorization_revoked` | Set seller PAYMENTS_DISABLED, halt order creation |
| `account.activated` / KYC events | Advance onboarding state machine |

`account.app.authorization_revoked` is mandatory. Without it you will keep creating orders
against a seller who disconnected, and every one will 401 at checkout time in front of a
buyer.

```json
{
  "event": "account.app.authorization_revoked",
  "account_id": "acc_Dhk2qDbmu6FwZH",
  "contains": [],
  "created_at": 1678282666
}
```

### 6.2 Handler shape

```ts
app.post('/webhooks/razorpay',
  express.raw({ type: 'application/json' }),   // RAW body — parsing first breaks the HMAC
  async (req, res) => {
    const sig = req.headers['x-razorpay-signature'];
    const expected = createHmac('sha256', CONFIG.webhookSecret)
      .update(req.body)                        // Buffer, unparsed
      .digest('hex');

    if (!safeEqual(sig, expected)) return res.sendStatus(400);

    const event = JSON.parse(req.body.toString());

    // Idempotency: unique index on (event_id) swallows replays.
    const inserted = await db.query(
      `INSERT INTO webhook_events (event_id, event_type, account_id, payload)
       VALUES ($1,$2,$3,$4) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
      [req.headers['x-razorpay-event-id'], event.event, event.account_id, event]
    );

    if (inserted.rowCount > 0) await queue.publish('razorpay.events', inserted.rows[0].id);

    res.sendStatus(200);   // ack fast; all real work happens in the worker
  }
);
```

Rules that matter:

- Respond 200 within a couple of seconds. Slow handlers get retried, which multiplies load
  exactly when you are already struggling.
- Every worker must be idempotent regardless of the dedupe table — retries and
  out-of-order delivery both happen.
- Order state transitions should be monotonic. A late `payment.failed` must not undo a
  `CONFIRMED` order.

---

## 7. Reconciliation

Webhooks are reliable, not infallible. Run two sweeps.

**Hourly — orphan hunt.** Any order in `CREATED` or `PAID_UNCONFIRMED` older than 30
minutes: `GET /v1/orders/{id}/payments` with that seller's token, resolve to a terminal
state.

**Daily — full sweep.** For each active seller, fetch payments for the previous day with
`from`/`to` timestamps, join on `notes.platform_order_id`, and assert:

- every Razorpay payment maps to one of your orders (unmapped ⇒ someone is creating orders
  outside your flow, or a stale integration)
- every order you believe is paid has a captured payment
- amounts match to the paise

Write mismatches to an exceptions table with an owner and an SLA. An unread reconciliation
report is the same as no reconciliation.

---

## 8. Failure modes

| Failure | Detection | Response |
|---|---|---|
| Seller revokes authorisation | `authorization_revoked` webhook | Disable orders, email reconnect link, keep historic data readable |
| Refresh token expired (180d) | 4xx on refresh | `REFRESH_FAILED`, re-consent required — no automated recovery |
| Concurrent refresh race | Sudden 401s on one seller | Prevented by the row lease; alert if it ever fires |
| Seller KYC deactivated by Razorpay | Account webhook, 4xx on order create | Disable, surface Razorpay's reason verbatim |
| Buyer closes tab after payment | Order stuck `CREATED` | Hourly sweep resolves it |
| Duplicate webhook | Unique event id conflict | Silently dropped |
| Razorpay API 5xx on order create | HTTP status | Retry with exponential backoff + jitter, 3 attempts, then fail the checkout cleanly |
| Amount rounding | Reconciliation mismatch | Store paise as integers everywhere. Never float. |

---

## 9. Security posture

- **PCI scope:** hosted Checkout means card data never touches your servers. Do not build a
  custom card form — it drags you into SAQ D.
- **Token isolation:** access tokens live in the vault service. Application code requests a
  token for a specific seller and gets it in memory; it never reads the credentials table
  directly.
- **CSRF:** the `state` parameter is mandatory, single-use, TTL-bounded, and bound to the
  authenticated seller session. Reject on any mismatch.
- **Open redirect:** whitelist `redirect_uri` values exactly. No wildcard subpaths.
- **PKCE:** Razorpay documents PKCE for its MCP OAuth server but not for the partner
  authorisation code flow. Since your exchange is server-to-server with a confidential
  client, the code interception risk PKCE addresses does not apply here — but confirm with
  your partner manager whether `code_challenge` is now supported, and adopt it if so.
- **Secret rotation:** `client_secret` rotation invalidates signature verification for
  in-flight payments. Support two active secrets during a rotation window and verify
  against both.
- **Least privilege:** request `read_write` only. Do not request `rx_read_write` or
  `rx_partner_read_write` unless you are actually moving money out of seller RazorpayX
  accounts — those scopes will make sellers hesitate at the consent screen and expand your
  blast radius for nothing.

---

## 10. Build order

> **Superseded by §12** for this codebase. §10 is the generic marketplace
> sequence; §12.0 is the phased plan that matches what `therapist_website`
> actually is (a SvelteKit monolith on Vercel, Drizzle, a few therapists).
> Build §12 in the phase order of §12.0. Keep §1–§10 as the reference for
> what each phase is buying you and what to add when volume arrives.

**Phase 1 — connect (1 week).** OAuth initiate + callback, credential vault with KMS,
manual token refresh. Test against the dev client in test mode with one internal sandbox
sub-merchant.

**Phase 2 — transact (1–2 weeks).** Order service, Checkout integration with
`public_token`, signature verification, webhook ingress with dedupe, order state machine.

**Phase 3 — survive (1 week).** Single-flight refresh with the row lease, expiry scheduler
and reminder emails, `authorization_revoked` handling, reconnect UX.

**Phase 4 — verify (1 week).** Hourly orphan sweep, daily reconciliation, exceptions
dashboard, alerting on refresh failures and webhook lag.

**Phase 5 — scale onboarding.** Sub-Merchant Onboarding APIs or the Custom Onboarding SDK
so new sellers never leave your product. Until you have proven demand, a "Connect your
existing Razorpay account" button and a support-assisted signup is enough.

Do not skip Phase 3. A payments integration that works on the happy path and dies silently
at day 90 is worse than no integration, because you will not find out from your monitoring
— you will find out from an angry seller.

---

## 11. Open questions for your Razorpay partner manager

1. What commission rate applies to your partner tier, and does it vary by payment method?
   UPI economics differ sharply from cards.
2. Which partner sub-type is your account on — Pure Platform, Aggregator, or Reseller? The
   onboarding APIs and co-branding options differ between them.
3. Is co-branded onboarding enabled for your account? Documentation has historically
   limited it to Aggregator partners.
4. Are there rate limits on `/v2/accounts` creation you should design around?
5. Confirm the current refresh-token TTL and whether PKCE is supported on the partner
   authorisation flow. These change.

---

## 12. v1 build plan (this codebase)

Context this plan is written against:

- SvelteKit monolith, deployed on Vercel. **One service, no queue, no workers.**
- Drizzle. Schema changes go through `npm run db:push` — **no migrations**
  pre-prod (see project `CLAUDE.md`).
- Razorpay client + subscription webhook already exist:
  `src/lib/server/razorpay.ts`, `src/routes/webhooks/razorpay/+server.ts`
  (has `verifyWebhookSignature`, a `razorpay_event` insert-on-conflict dedupe).
- The `payment` table **already carries** `razorpayOrderId` (unique),
  `razorpayPaymentId`, `paidVia` (`manual` | `razorpay`), and a
  `payment_status` enum (`unpaid` | `paid`). `paymentSettings.paymentMode`
  enum (`manual` | `automatic`) already exists.
- `therapist.currency` defaults to `INR`. There is **no** `razorpayAccountId`
  column and there won't be — the connection row (below) is the source of truth.
- Cron already runs: Vercel Cron → `GET /api/cron/reminders` (bearer
  `CRON_SECRET`), daily 09:00, calls functions in
  `src/lib/server/reminderEmails.ts`.
- Checkout.js is loaded via the `loadCheckoutScript()` pattern in
  `src/routes/pricing/+page.svelte`.
- `CURRENT_ENVIRONMENT === 'testing'` swaps a `TEST_`-prefixed key set via
  `rzpEnv()` in `razorpay.ts`. OAuth config follows the same rule: the dev
  client is test-mode only, the prod client live-mode only.

### 12.0 Build phases

Ship in four deployable increments. Each goes to prod on its own without
leaving a landmine. Two coupling rules drive the order:

- The **single-flight refresh lock** ships with the first code that refreshes a
  token — it lives inside `getAccessToken`, you don't split it out.
- **`account.app.authorization_revoked`** handling ships with the first code
  that lets a client check out. The moment a therapist can take a payment, a
  therapist can disconnect and 401 every client checkout. It is not a "verify"
  phase item.

**Phase 0 — partner tier (no code).** Confirm with the Razorpay partner manager
that the account is Technology Partner / Pure Platform with an OAuth client
issued for test *and* prod (§11 Q2/Q5). External lead time — start first.
Nothing below works without it.

**Phase 1 — connect, no money moves.** Schema table + `db:push` ·
`tokenCrypto.ts` · `razorpay.ts` OAuth config + `exchangeOAuthCode` +
`refreshOAuthToken` · `razorpayConnection.ts` (`getAccessToken` **with the
single-flight lock**, `storeConnection`, `disconnect`, `connectionHealth`) ·
connect + callback routes · settings banner (`not_connected` / `connected` +
Connect button). Ships: therapists connect their Razorpay account; nothing
charges anyone.

**Phase 2 — take one payment.** `createSubMerchantOrder` · `sessionPayments.ts`
(order create + capture handler) · webhook branch for `payment.captured`
**and `account.app.authorization_revoked`** · portal "Pay now" + `payInvoice`
action · `action_needed` banner state + Reconnect button. Ships: clients pay
invoices in the portal. Phase 1 + 2 together is the "clients can pay"
milestone, ~1.5 weeks of build.

**Phase 3 — survive day 90.** `refreshExpiringConnections()` cron (§12.7) ·
reconnect email from the `getAccessToken` 4xx path (§13.2). Deploy within ~80
days of the first prod token. This is what stops the integration dying
silently — not optional, ~1 day.

**Phase 4 — verify at volume.** Hourly orphan sweep + daily reconciliation +
exceptions table (§7) · account-mismatch guard (§13.4) · `expiring` banner
state · full test matrix (§12.11). Add when therapist count or transaction
volume makes manual spot-checking infeasible. None of it blocks first revenue.

### 12.1 In / out for v1

| In | Deferred (add per §4–§9 when volume justifies) |
|---|---|
| OAuth connect + callback (`state`, code URL-decode, exact `redirect_uri`) | Programmatic `/v2/accounts` onboarding, Custom Onboarding SDK |
| Encrypted token storage — AES-256-GCM, key from env | AWS/GCP KMS envelope encryption, per-row data keys |
| Single-flight refresh with a DB row lease + proactive refresh | Redis, in-memory token cache |
| Proactive refresh cron — rotates the token for dormant therapists (§12.7) | Pre-emptive "reconnect in 30 days" nag email (§4.2) — redundant once the cron runs |
| Order create as sub-merchant, checkout with `public_token` | `transfers` / platform per-transaction fee (dead in this model anyway, §1) |
| Signature verify keyed on `client_secret` | Two-secret rotation window |
| Webhook branch: `payment.captured`, `account.app.authorization_revoked` | `order.paid` cross-check, refund ledger, KYC state machine |
| Server-side gate: orders only against a connected+active therapist | 8-state onboarding machine |
| Connection-health line in therapist settings | Hourly orphan sweep, daily full reconciliation, exceptions dashboard |

Non-INR therapists: the feature is INR-only. Gate on
`therapist.currency === 'INR'` everywhere an order could be created, same as
the old Route plan did.

### 12.2 Schema — one table, in `payments.schema.ts`, then `db:push`

```ts
export const razorpayConnectionStatusEnum = pgEnum('razorpay_connection_status', [
  'active',          // tokens good
  'refresh_failed',  // 4xx on refresh — therapist must re-consent
  'revoked'          // authorization_revoked webhook, or therapist disconnected
]);

export const therapistRazorpayConnection = pgTable('therapist_razorpay_connection', {
  therapistId: text('therapist_id')
    .primaryKey()
    .references(() => therapist.id, { onDelete: 'cascade' }),
  razorpayAccountId: text('razorpay_account_id').notNull(), // acc_… — historic-order anchor
  mode: text('mode').notNull(),                              // 'test' | 'live'

  // AES-256-GCM; format "<iv b64>.<tag b64>.<ciphertext b64>". Never plaintext at rest.
  accessTokenEnc: text('access_token_enc').notNull(),
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  publicToken: text('public_token').notNull(),               // not secret — goes to Checkout

  accessExpiresAt: timestamp('access_expires_at').notNull(),
  refreshExpiresAt: timestamp('refresh_expires_at').notNull(),

  status: razorpayConnectionStatusEnum('status').notNull().default('active'),
  refreshLockUntil: timestamp('refresh_lock_until'),         // single-flight guard
  refreshFailureCount: integer('refresh_failure_count').notNull().default(0),
  lastRefreshedAt: timestamp('last_refreshed_at'),
  reconnectEmailSentAt: timestamp('reconnect_email_sent_at'),  // throttle the §13.2 failure emails

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
});
```

No `state` table. The OAuth `state` is a signed, `httpOnly`, 10-minute cookie
(`rzp_oauth_state`) set at initiate and compared on callback — it's inherently
bound to the logged-in therapist's session (double-submit), so a table buys
nothing.

Update the stale comment in `payments.schema.ts` that references
`therapist.razorpayAccountId` — the flag is now
`therapistRazorpayConnection.status === 'active'`.

### 12.3 `src/lib/server/tokenCrypto.ts` — new

Two functions, `encryptToken(plain): string` / `decryptToken(blob): string`,
using `node:crypto` `createCipheriv('aes-256-gcm', key, iv)`. Key from
`env.TOKEN_ENC_KEY` (32 bytes, base64) — throw loudly if unset or wrong length.
Leaves one `assert`-based self-check (round-trip + tampered-tag rejection).

```
// ponytail: single static key from env. Per-row KMS-wrapped data keys (§4.3)
// when a DB dump is a real threat and KMS call cost is acceptable.
```

### 12.4 `razorpay.ts` additions

- `razorpayOAuthConfig()` → `{ clientId, clientSecret, redirectUri }` via `rzpEnv`
  (`RAZORPAY_OAUTH_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI`).
- `exchangeOAuthCode(code)` → `POST https://auth.razorpay.com/token`,
  `grant_type: 'authorization_code'`, `mode` from `TESTING`. **URL-decode
  `code` first** (§3.1). `redirect_uri` must byte-match the initiate URL.
- `refreshOAuthToken(refreshToken)` → same endpoint, `grant_type: 'refresh_token'`.
- `createSubMerchantOrder({ accessToken, amountMinor, receipt, notes })` →
  `POST https://api.razorpay.com/v1/orders` with `Authorization: Bearer`. No
  `X-Razorpay-Account` header — the token scopes the account.
- `verifyOAuthPaymentSignature(orderId, paymentId, signature)` — HMAC-SHA256
  keyed on **`client_secret`** (§5.4), `timingSafeEqual` with the length guard.

### 12.5 `src/lib/server/razorpayConnection.ts` — new

- `getAccessToken(therapistId): Promise<string>` — the §4.2 algorithm in
  Drizzle. Refresh proactively when `accessExpiresAt < now + 10 days`. Row
  lease via `UPDATE … SET refreshLockUntil = now() + 60s WHERE therapistId = ?
  AND (refreshLockUntil IS NULL OR refreshLockUntil < now()) RETURNING …`.
  Lost the lease → sleep jitter(500–2000ms), recurse. On 4xx from the token
  endpoint → `status = 'refresh_failed'`, notify therapist (§13), throw. Persist
  both rotated tokens in one statement before returning.
- `storeConnection(therapistId, tokenResponse, mode)` — upsert on
  `therapistId`. Computes `accessExpiresAt` / `refreshExpiresAt` from
  `expires_in` (fall back to 90d / 180d if absent, then confirm real TTLs with
  the partner manager — §11).
- `disconnect(therapistId, reason)` — `status = 'revoked'`; also flip
  `paymentSettings.paymentMode` back to `'manual'` so the portal stops
  offering "Pay now".
- `connectionHealth(therapistId)` →
  `'not_connected' | 'connected' | 'expiring' | 'action_needed'`
  (`expiring` = `refreshExpiresAt < now + 30d`; `action_needed` =
  status `refresh_failed` or `revoked`). Used by the settings banner (§13).
- `refreshExpiringConnections()` (Phase 3) — the §12.7 cron entry point. Selects
  `status = 'active'` connections with `accessExpiresAt < now + 10d` and calls
  `getAccessToken` on each.
- Never log `access_token` / `refresh_token` / `code` / `client_secret` —
  redact in the one `postJson` helper, not per call site.

`getAccessToken` + `storeConnection` + `disconnect` + `connectionHealth` are
Phase 1; `refreshExpiringConnections` and the 4xx reconnect email are Phase 3.

### 12.6 OAuth routes — under `(app)` so they're behind therapist auth

- `GET /settings/payments/connect/+server.ts`:
  1. `event.locals` therapist required; `therapist.currency === 'INR'` or
     redirect back with an error.
  2. `state = randomBytes(32).toString('hex')`; set signed `httpOnly` cookie
     `rzp_oauth_state` (`maxAge` 600, `sameSite: 'lax'` so it survives the
     Razorpay round-trip).
  3. 302 to `https://auth.razorpay.com/authorize?client_id=…&response_type=code
     &redirect_uri=…&scope[]=read_write&state=…`. **`read_write` only** (§9).
- `GET /settings/payments/connect/callback/+server.ts`:
  1. `state` query param must equal the cookie; clear the cookie (single use).
     Mismatch → redirect to `/settings?payments=state_error`.
  2. `error` query param present (therapist declined) →
     `/settings?payments=declined`.
  3. `exchangeOAuthCode(code)` → `storeConnection(...)`.
  4. If a connection row already existed with a **different**
     `razorpayAccountId`, still store it but redirect with
     `?payments=account_changed` so the UI can warn (historic orders were
     against the old `acc_…`).
  5. Redirect `/settings?payments=connected`.

### 12.7 Proactive token refresh — cron (Phase 3)

New `refreshExpiringConnections()` in `razorpayConnection.ts`, called from
`GET /api/cron/reminders` alongside the existing reminder functions (no new
cron entry, no `vercel.json` change):

- Select connections where `status = 'active'`
  AND `accessExpiresAt < now + 10 days`.
- For each: `await getAccessToken(therapistId)` — the §12.5 function already
  does the locked refresh and persists both rotated tokens. The cron just calls
  it for therapists whose checkout flow isn't calling it on its own.

Because the refresh token rotates on every use (§4.2), each refresh also slides
`refreshExpiresAt` forward. So a therapist who never takes a payment still
keeps a live token indefinitely as long as the cron runs — no separate
dormancy nag needed. The generic §4.2 "email sellers 30 days before
`refresh_expires_at`" guard is a workaround for *not* having this cron; with
it, that guard is redundant.

The only reconnect emails that fire are failure-driven: `getAccessToken`
catching a 4xx on refresh (token genuinely dead) and the
`authorization_revoked` webhook. Both are unavoidable and both are covered in
§13.2.

If the cron is down long enough for tokens to actually expire, `getAccessToken`
on the checkout path still refreshes on demand (or fails to `refresh_failed`
and emails the therapist). The cron is the proactive layer, not the only one.

### 12.8 Session payment — `src/lib/server/sessionPayments.ts` — new

- `startInvoiceCheckout(clientId, paymentId)`:
  1. Load the `payment` row: must be this client's, `status = 'unpaid'`,
     `paidVia = 'manual'`.
  2. Load therapist + connection: `currency = 'INR'`,
     `connection.status = 'active'`.
  3. If `payment.razorpayOrderId` is set and was written < ~15 min ago and the
     row is still unpaid — reuse it (mirrors `createOrReusePendingSub`'s intent;
     a stale Razorpay order just expires on its own).
  4. Else `token = await getAccessToken(therapistId)`,
     `createSubMerchantOrder({ token, amountMinor: amount * 100,
     receipt: paymentId, notes: { paymentId, therapistId, clientId } })`,
     write `razorpayOrderId` onto the row.
  5. Return `{ orderId, key: connection.publicToken, amountMinor,
     therapistName }`.
- `handleSessionPaymentCaptured({ orderId, razorpayPaymentId, amount })`:
  1. Find the `payment` row by `razorpayOrderId`. None → 200 no-op (not ours).
  2. Already `paid` → 200 no-op (idempotent).
  3. Optional amount check to the paise; mismatch → log an exception, still 200.
  4. Set `status = 'paid'`, `paidVia = 'razorpay'`, `razorpayPaymentId`,
     `paidAt = now`. Reuse `setPaymentStatus` if it already does the pack /
     balance bookkeeping.

### 12.9 Portal — `src/routes/(portal)/portal/`

- `+page.server.ts` `load`: also return, per unpaid invoice, whether portal
  pay is available (`therapist.currency === 'INR'` &&
  `connectionHealth(therapistId) === 'connected'`).
- New `payInvoice` action: `event.locals.clientId` required; call
  `startInvoiceCheckout(clientId, formData.paymentId)`; return the checkout
  params or `fail(400, { message })`.
- `+page.svelte`: "Pay now" button on `due` invoices when portal pay is
  available. On click → POST `?/payInvoice` → `loadCheckoutScript()` →
  `new window.Razorpay({ key: publicToken, order_id, name: therapistName,
  handler: () => showProcessing() })`. The real flip is the webhook — the
  handler only shows "payment processing", exactly like the subscription flow.

### 12.10 Webhook — refactor `src/routes/webhooks/razorpay/+server.ts`

Today it early-returns unless there's a `subscription.entity` +
`notes.therapistId`. Restructure to branch on `payload.event` *before* that
check:

- `payment.captured` (and later `order.paid`): pull
  `payload.payload.payment.entity` → `order_id`, `id`, `amount`;
  `handleSessionPaymentCaptured({ orderId: order_id, razorpayPaymentId: id,
  amount })`.
- `account.app.authorization_revoked`: `payload.payload` carries `account_id`;
  look the connection up by `razorpayAccountId`, `disconnect(therapistId,
  'revoked')`, email the therapist a reconnect link (§13). **Mandatory** —
  without it every subsequent portal checkout 401s in front of a client (§6.1).
- Everything else → existing subscription path unchanged.

Idempotency: keep the existing `razorpay_event` insert-on-conflict guard; add
`x-razorpay-event-id` as the conflict key if it isn't already. Signature check
(`verifyWebhookSignature`, raw body) already covers all event types — enable
`payment.captured` and `account.app.authorization_revoked` in the Razorpay
dashboard webhook config (same endpoint, same secret).

### 12.11 Tests (`tests/integration/`, per `project_test_setup`)

Split across phases per §12.12 — Phase 1 covers the OAuth callback,
`getAccessToken` and `tokenCrypto`; Phase 2 covers the webhook and
`startInvoiceCheckout`; Phase 4 fills in the rest.

- OAuth callback: state mismatch rejected; happy path stores an encrypted
  connection row.
- `getAccessToken`: proactive refresh persists both rotated tokens; a second
  concurrent call blocks on the lease rather than double-refreshing; 4xx →
  `refresh_failed` + no retry.
- `tokenCrypto`: round-trips; rejects a tampered auth tag.
- `startInvoiceCheckout`: non-INR therapist blocked; disconnected therapist
  blocked; a fresh existing order is reused, not duplicated.
- Webhook: `payment.captured` marks the row paid exactly once (replay is a
  no-op); `authorization_revoked` sets the connection `revoked` and
  `paymentMode` back to `manual`.

### 12.12 File checklist, grouped by phase

**Phase 0 — before any code**

- Razorpay dashboard — OAuth client (test + prod), whitelist both
  `redirect_uri`s incl. localhost, enable the `payment.captured` and
  `account.app.authorization_revoked` webhook events.
- Env vars: `RAZORPAY_OAUTH_CLIENT_ID`, `RAZORPAY_OAUTH_CLIENT_SECRET`,
  `RAZORPAY_OAUTH_REDIRECT_URI`, `TOKEN_ENC_KEY` — each with a `TEST_`-prefixed
  twin.

**Phase 1 — connect**

1. `payments.schema.ts` — `therapistRazorpayConnection` + enum; fix the stale
   `therapist.razorpayAccountId` comment → `npm run db:push`
2. `src/lib/server/tokenCrypto.ts`
3. `src/lib/server/razorpay.ts` — OAuth config + `exchangeOAuthCode` +
   `refreshOAuthToken` + `verifyOAuthPaymentSignature`
4. `src/lib/server/razorpayConnection.ts` — `getAccessToken` (with the row
   lease), `storeConnection`, `disconnect`, `connectionHealth`
5. `src/routes/(app)/settings/payments/connect/+server.ts` + `callback/+server.ts`
6. `src/routes/(app)/settings/+page.server.ts` + `+page.svelte` — health banner,
   Connect button, `?payments=…` toasts (§13.1)
7. `tests/integration/` — OAuth callback state mismatch; `getAccessToken` locked
   refresh + concurrent-call blocks; `tokenCrypto` round-trip + tampered tag

**Phase 2 — take one payment**

8. `src/lib/server/razorpay.ts` — `createSubMerchantOrder`
9. `src/lib/server/sessionPayments.ts`
10. `src/routes/(portal)/portal/+page.server.ts` + `+page.svelte` — `payInvoice`
    + "Pay now"
11. `src/routes/webhooks/razorpay/+server.ts` — branch on `payload.event`:
    `payment.captured` and `account.app.authorization_revoked` before the
    existing subscription check
12. `src/routes/(app)/settings/+page.svelte` — `action_needed` state +
    Reconnect button
13. `src/lib/server/reminderEmails.ts` — reconnect email body (used by the
    revoked webhook now, by the cron in Phase 3)
14. `tests/integration/` — `payment.captured` marks the row paid once (replay
    no-op); `authorization_revoked` → `revoked` + `paymentMode` back to
    `manual`; `startInvoiceCheckout` blocks non-INR / disconnected

**Phase 3 — survive day 90**

15. `src/lib/server/razorpayConnection.ts` — `refreshExpiringConnections()` +
    the 4xx-refresh reconnect email
16. `src/routes/api/cron/reminders/+server.ts` — call `refreshExpiringConnections()`

**Phase 4 — verify at volume**

17. Hourly orphan sweep + daily reconciliation + exceptions table (§7)
18. Account-mismatch guard — `?payments=account_changed` (§13.4)
19. `expiring` banner state (§13.1); remaining test cases (§12.11)

### 12.13 Effort estimate

One developer familiar with this codebase.

| Phase | Work | Est. |
|---|---|---|
| 0 | Partner-manager confirmation + OAuth client issued (§11 Q2/Q5) | external lead time |
| 1 | Schema + `db:push`; `tokenCrypto.ts`; `razorpay.ts` OAuth helpers; `razorpayConnection.ts` (vault + single-flight refresh + health); connect/callback routes; settings banner; Phase-1 tests | ~3.5–4.5 d |
| 2 | `createSubMerchantOrder`; `sessionPayments.ts`; portal "Pay now" + `payInvoice`; webhook branch (`payment.captured` + `authorization_revoked`); reconnect email body; Phase-2 tests | ~2.5–3 d |
| 3 | `refreshExpiringConnections()` + cron wiring; 4xx reconnect email | ~1 d |
| 4 | Reconciliation + orphan sweep + exceptions table; account-mismatch guard; `expiring` state; remaining tests | ~2–2.5 d |

**Phase 1 + 2 ≈ 1.5 weeks** to "clients can pay in the portal". Phase 3 is a
day and must land within ~80 days of the first prod token. Phase 4 is
volume-driven and blocks nothing.

**The load-bearing piece is the single-flight refresh lock in
`getAccessToken`.** The refresh token rotates on every use (§4.2), so two
concurrent refreshes race — one wins, the other burns an invalidated token and
that therapist is locked out until they re-consent. The row lease
(`UPDATE … SET refreshLockUntil = now() + 60s WHERE … RETURNING`) has to be
correct. Everything else in Phase 1 is mechanical.

**Wall-clock is gated by Phase 0** — Razorpay issuing the OAuth client on a
Pure Platform tier. Start that conversation before writing code.

---

## 13. Reconnect flow

Reconnection is not a separate feature — it's the same
`/settings/payments/connect` initiate endpoint (§12.6). Razorpay shows the
consent screen again, `exchangeOAuthCode` returns a fresh token pair, and
`storeConnection` upserts on `therapistId`, overwriting the dead tokens and
resetting `status` to `active`, `refreshFailureCount` to 0,
`reconnectEmailSentAt` to null. Nothing else to build for the mechanism.

What makes it *usable* — the therapist has to know they need to:

1. **Settings banner.** `connectionHealth(therapistId)` drives a line in the
   payments section of `/settings`:
   - `not_connected` → "Connect Razorpay to let clients pay in the portal"
     + **Connect** button.
   - `connected` → "Payments connected · renews automatically" (quiet, no CTA).
   - `expiring` → amber "Reconnect by `<refreshExpiresAt>` to keep portal
     payments working" + **Reconnect** button. (Phase 4 — with the §12.7 cron
     running this only appears if the cron itself has been failing.)
   - `action_needed` → red "Portal payments are paused — reconnect to resume"
     + **Reconnect** button. Shown whenever `status` is `refresh_failed` or
     `revoked`.
   Also handle the `?payments=…` redirect params from §12.6 as a toast:
   `connected` / `declined` / `state_error` / `account_changed` (the last one:
   "You connected a different Razorpay account — past invoices stay linked to
   the old one").

2. **Email triggers**, both linking to `/settings/payments/connect`, both
   failure-driven:
   - `getAccessToken` hitting a 4xx refresh → immediate "Portal payments have
     stopped — reconnect to resume" (Phase 3).
   - `account.app.authorization_revoked` webhook → "Your Razorpay account was
     disconnected from `<platform>`" (Phase 2).
   Throttle both off `reconnectEmailSentAt` so a therapist whose token died
   isn't emailed on every cron run. There is no pre-emptive nag — the §12.7
   cron keeps live tokens from expiring in the first place.

3. **Portal degrades quietly.** While a therapist is disconnected, the "Pay
   now" button just isn't rendered (§12.9 already gates on
   `connectionHealth === 'connected'`) — clients fall back to paying
   off-platform and the therapist ticking the row manually, exactly as today.
   No error shown to the client.

4. **Account-mismatch guard.** (Phase 4.) On reconnect, if the new `razorpayAccountId`
   differs from the stored one, keep both the new connection and all historic
   `payment` rows (their `razorpayOrderId` / `razorpayPaymentId` still resolve
   against the old account for reconciliation). Surface the
   `?payments=account_changed` warning so it's a conscious choice, not a silent
   swap.

---

*Not legal or financial advice. The RBI PA Directions, 2025 are recent and the partner
model's treatment of platform fees in particular is worth an hour with a fintech lawyer
before you build revenue logic on it.*
