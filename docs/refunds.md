# Therapist-initiated refunds

Let a therapist refund (fully or partly) a session payment — either through Razorpay
(money goes back automatically) or by recording a manual refund they paid back
themselves (cash / UPI / bank transfer).

## Decisions

- **One refund per payment, ever.** It can be partial. A `failed` refund doesn't
  count (no money moved), so it can be retried; a `pending` or `processed` one blocks
  any further refund. Enforced by a partial unique index, which also blocks
  double-click / two-tab duplicates.
- **Two methods:** `razorpay` (calls Razorpay) and `manual` (just recorded, no API call).
  Manual works on any paid row, Razorpay-paid or marked paid by hand.
- **"Deducted for sure"** (Razorpay method only) = our row has `paidVia = 'razorpay'` and
  a `razorpayPaymentId`, **and** Razorpay (`GET /payments/:id` with the therapist's
  OAuth token) says `status = 'captured'`, with `order_id` matching our
  `razorpayOrderId`. Razorpay is the proof, not our row.
- Refund amount: positive whole rupees, at most the amount paid.
- After a refund the payment row **stays `paid`**. The row shows
  **Paid ₹X · Refunded ₹Y · Remaining ₹(X−Y)** ("remaining" = what the therapist keeps)
  and the refund buttons disappear. Same three numbers in the client portal.
- Refund speed `normal`.

### Razorpay notes (traceability)

Every session payment and every refund on Razorpay carries exactly:

```
notes: { razorpay_payment_id, razorpay_order_id }
```

- **Refunds:** both ids are known up front, so they go in the refund request.
  `receipt` = our `payment_refund` row id.
- **Payments:** neither id exists when the order is created, so after capture we
  `PATCH /payments/:id` with the notes. This lives in `handleSessionInvoicePaid`, so
  both the `payment.captured` webhook and the daily reconciliation sweep do it —
  including the second payment of an `already_paid` double charge. A failed PATCH is
  logged and ignored; it never undoes marking the row paid.
- **Orders:** the current order notes `{ paymentId, therapistId, clientId }` are
  dropped (nothing reads them). `receipt` still holds our payment id.
- Subscription notes are untouched — the webhook depends on them.

## Refund states

```
              ┌──→ processed   (done; payment locked)
  pending ────┤
              └──→ failed      (no money moved; a new attempt is a new row)
```

A row never goes back to `pending`. Retrying after `failed` inserts a new row.

Razorpay flow:

1. **Checks, before writing anything** — ownership, paid, amount valid, Razorpay
   connected, Razorpay says captured. Any failure → inline error, **no row created**.
   No connection / dead token → "Reconnect Razorpay in Settings".
2. **Insert `pending` row** — the unique index is the lock.
3. **Call Razorpay:**

| Outcome | Row becomes | Therapist sees |
|---|---|---|
| Accepted, Razorpay status `processed` | `processed` + `razorpayRefundId` | Paid / Refunded / Remaining |
| Accepted, Razorpay status `pending` | stays `pending` + `razorpayRefundId` | "refund ₹Y pending" |
| Refused (4xx + reason) | `failed` + `failureReason` | Razorpay's reason inline, "refund failed" badge, button stays |
| Timeout / network drop | stays `pending`, no refund id | "Couldn't confirm — check your Razorpay dashboard" |

Timeouts stay `pending` because the refund may have gone through; marking it `failed`
could let the therapist refund twice.

**Resolving a `pending` row** — next time the therapist opens that payment's refund:
- has `razorpayRefundId` → `GET /refunds/:id`, copy its status;
- no refund id (timeout) → `GET /payments/:id/refunds`, look for one whose `receipt` is
  our row id: found → `processed` (store the id), not found → `failed`.

Manual flow: checks, then insert straight as `processed`. No other error case.

Either method, on success: resolve any open `cancel_refund` / `already_paid` flag on
that payment.

## Steps

1. **Razorpay helpers** — `src/lib/server/razorpay.ts`, same pattern as
   `createSubMerchantOrder` (Bearer token, 20s timeout, error description surfaced,
   integer paise):
   - `fetchSubMerchantPayment(accessToken, paymentId)` → status, amount, amount_refunded, order_id
   - `createSubMerchantRefund({ accessToken, paymentId, amountMinor, receipt, notes })`
   - `fetchSubMerchantRefund(accessToken, refundId)`
   - `fetchSubMerchantPaymentRefunds(accessToken, paymentId)`
   - `updateSubMerchantPaymentNotes(accessToken, paymentId, notes)`
   - A timeout must be distinguishable from a Razorpay refusal (throw a distinct error).

2. **Schema + migration** — `src/lib/server/db/payments.schema.ts` *(needs approval)*
   - Enums `refund_status` (`pending | processed | failed`), `refund_method` (`razorpay | manual`)
   - Table `payment_refund`: `id`, `paymentId` (fk), `therapistId` (fk), `method`,
     `amount` (whole rupees), `status`, `razorpayPaymentId` (copied from the payment),
     `razorpayRefundId` (unique, nullable), `failureReason`, `createdAt`, `updatedAt`
   - Partial unique index on `paymentId where status in ('pending', 'processed')`
   - Additive only. `npm run db:generate`; the user runs `db:migrate`.

3. **Payment notes** — `sessionPayments.ts`
   - `handleSessionInvoicePaid`: after capture, PATCH the two notes; log on failure.
   - `startInvoiceCheckout`: drop the order notes.

4. **Server module** — `src/lib/server/paymentRefunds.ts`
   - `refundViaRazorpay(therapistId, paymentId, amount)` — the flow above
   - `recordManualRefund(therapistId, paymentId, amount)`
   - `resolvePendingRefund(therapistId, paymentId)` — the pending resolution above
   - `listRefundsForPayments(paymentIds)` — for the Paid / Refunded / Remaining display

5. **Actions + UI**
   - `refundRazorpay` and `refundManual` form actions on `/payments`, therapist from the
     session, amount a positive integer. Errors returned via `fail()` and shown inline.
   - `PaymentHistoryList.svelte`, expanded row: "Refund via Razorpay" (Razorpay-paid rows
     only) and "Record manual refund", each with an amount input defaulting to the full
     amount and an inline confirm (no browser dialog). Hidden once refunded/pending.
   - Client portal payments page: same Paid / Refunded / Remaining numbers.

6. **Tests** — `tests/integration/paymentRefunds.test.ts`, `fetch` mocked:
   full refund, partial refund, over-refund refused, non-captured refused, order_id
   mismatch refused, other therapist's payment refused, concurrent duplicate blocked,
   second refund after processed refused, Razorpay refusal → `failed`, failed refund
   retried, timeout → `pending` → resolved on retry, manual refund on a manual payment,
   open refund flag resolved, refund notes carry both ids, capture PATCHes payment notes
   and a failed PATCH still marks paid.

## Not in v1

- `refund.processed` / `refund.failed` webhooks — pending rows are resolved on next open
  instead; add webhooks if refunds sit in `pending`.
- Refunding the `already_paid` double charge from this button — that second payment's
  id lives only in the flag's `detail` text, not on a row. Needs its own column.
