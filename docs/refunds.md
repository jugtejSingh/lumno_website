# Therapist-initiated refunds

Let a therapist refund (fully or partly) any session payment a client made to them
through Razorpay — but only money that was definitely taken.

## Decisions

- **"Deducted for sure"** = our `payment` row has `paidVia = 'razorpay'` and a
  `razorpayPaymentId`, **and** Razorpay itself (`GET /payments/:id` with the
  therapist's OAuth token) says `status = 'captured'`. Razorpay is the proof, not our row.
- The payment's `order_id` from Razorpay must match our row's `razorpayOrderId`.
- Partial refunds allowed, up to `amount − amount_refunded` (Razorpay's numbers).
- After any refund, even a full one, the row **stays `paid`** and shows a
  "refunded ₹X" badge. The client does not owe it again.
- Refund speed `normal`.

## Steps

1. **Razorpay helpers** — `src/lib/server/razorpay.ts`
   - `fetchSubMerchantPayment(accessToken, paymentId)` → status, amount, amount_refunded, order_id
   - `createSubMerchantRefund({ accessToken, paymentId, amountMinor, receipt, notes })`
   - Same pattern as `createSubMerchantOrder`: Bearer token, 20s timeout, Razorpay error
     description surfaced. Amounts in integer paise.

2. **Schema + migration** — `src/lib/server/db/payments.schema.ts` *(needs approval)*
   - New enum `refund_status`: `pending | processed | failed`
   - New table `payment_refund`: `id`, `paymentId` (fk), `therapistId` (fk), `amount`
     (whole rupees, like `payment.amount`), `status`, `razorpayRefundId` (unique, nullable
     — filled after the call), `failureReason`, `createdAt`, `updatedAt`
   - Partial unique index on `paymentId where status = 'pending'` — one in-flight refund
     per payment, blocks double-click / two-tab double refunds.
   - Additive only. `npm run db:generate`; the user runs `db:migrate`.

3. **Server module** — `src/lib/server/paymentRefunds.ts`
   `refundPayment(therapistId, paymentId, amount)`:
   1. Load the row scoped to `therapistId`; require `paidVia = 'razorpay'` + `razorpayPaymentId`.
   2. Require an active Razorpay connection; get the token via `getAccessToken`.
   3. Fetch the payment from Razorpay: must be `captured` (or `refunded` partially),
      `order_id` must match, and `amount ≤ amount − amount_refunded`.
   4. Insert a `pending` `payment_refund` row (unique index = the lock).
   5. Call `createSubMerchantRefund` with `receipt = refund row id`.
   6. Success → store `razorpayRefundId` + status. Failure → mark `failed` with reason,
      return the reason to the UI.
   7. Resolve any open `cancel_refund` / `already_paid` flag on that payment.
   - `listRefundsForPayments(paymentIds)` for the history badges.

4. **Action + UI**
   - `refund` form action on `/payments` (`+page.server.ts`), therapist from the session,
     amount validated as a positive integer.
   - `PaymentHistoryList.svelte`: "Refund" button in the expanded row, only on
     Razorpay-paid rows with something left to refund. Amount input defaulting to the
     remaining refundable amount, inline confirm (no browser dialog). Badge
     "refunded ₹X" / "refund ₹X pending" / "refund failed".
   - Client portal payments page shows the same refunded badge.

5. **Tests** — `tests/integration/paymentRefunds.test.ts`, `fetch` mocked:
   full refund, partial refund, over-refund refused, non-captured refused, order_id
   mismatch refused, other therapist's payment refused, concurrent duplicate blocked,
   Razorpay failure → `failed` row, open refund flag resolved.

## Not in v1

- `refund.processed` / `refund.failed` webhooks — trust Razorpay's synchronous response;
  add if refunds get stuck in `pending`.
- Refunding the `already_paid` double charge from this button — that second payment's
  id lives only in the flag's `detail` text, not on the row. Needs its own column.
- Refunding manual (off-platform) payments — nothing to call; "Mark refunded" covers it.
