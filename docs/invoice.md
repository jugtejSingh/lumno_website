# GST invoices

Therapists who bill companies need a GST invoice the company can use for input
tax credit. The therapist sets up an invoice template once, adds GST details to
the clients that need them, and generates a printable invoice from the Payments
tab whenever they need one.

## Decisions

- **Therapist only.** Clients see nothing — no portal view, no portal billing form.
- **India only.** Feature shows only when `therapist.currency === 'INR'`.
- **All plans.** No `THERAPIST_PLAN_USAGE` key.
- **Invoices are not stored.** Built fresh from live data every time the page
  opens. Edits on the page are throw-away; the therapist saves via the browser's
  Print / Save as PDF.
- **Amounts are GST-inclusive.** `payment.amount` is the total the client pays;
  the invoice back-calculates the taxable value. Nothing about how payments are
  created, charged or paid changes.
- **Numbering** comes from a counter on the template (see below). No record of
  which number went to which invoice.

## 1. Stored data (one migration, additive only)

New file `src/lib/server/db/invoices.schema.ts`, exported from `schema.ts`.

### `invoice_template` — one row per therapist

| column             | notes                                                     |
| ------------------ | --------------------------------------------------------- |
| `therapist_id`     | PK, FK therapist, cascade                                 |
| `legal_name`       | required                                                  |
| `address`          | required                                                  |
| `state_code`       | required, 2-digit GST state code; auto-filled from GSTIN  |
| `gstin`            | nullable — no GSTIN prints a Bill of Supply               |
| `sac_code`         | required, default `9993`                                  |
| `default_gst_rate` | integer percent, default `18`                             |
| `number_prefix`    | e.g. `ANV/2026-27/`                                       |
| `next_number`      | integer, default `1`                                      |
| `footer`           | free text — bank/UPI details, terms, thank-you line       |
| `logo_key`         | nullable S3 key                                           |
| `signature_key`    | nullable S3 key                                           |

### `client_billing` — one row per client (therapist-edited)

| column         | notes                                                         |
| -------------- | ------------------------------------------------------------- |
| `client_id`    | PK, FK client, cascade                                        |
| `company_name` | billed-to name                                                |
| `gstin`        | nullable                                                      |
| `address`      | billing address                                               |
| `state_code`   | nullable, auto-filled from GSTIN; falls back to `client.state` |
| `tax_type`     | enum `auto` / `cgst_sgst` / `igst` / `none`, default `auto`   |
| `gst_rate`     | nullable integer; null = template's `default_gst_rate`        |

Flow: edit schema → `npm run db:generate` → user runs `npm run db:migrate`.

## 2. Server — `src/lib/server/invoices.ts`

- `getInvoiceTemplate` / `saveInvoiceTemplate`
- `getClientBilling` / `saveClientBilling`
- `validateGstin(value)` — `^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`;
  state code = first 2 digits
- `buildInvoice(therapistId, input)` — returns the pre-filled invoice data:
  - `input.mode = 'session'` → one line from one payment
  - `input.mode = 'weekly' | 'monthly'` → every payment for the client in the
    period, paid and due. A payment with an appointment counts by
    `appointment.startAt`; one without counts by `payment.createdAt`. Each line
    shows Paid / Due.
  - `input.mode = 'custom'` → parties only, no lines
  - every payment/client lookup is scoped to `therapistId`
- `consumeInvoiceNumber(therapistId, number)` — called on print. Bumps
  `next_number` only if `number` equals the currently suggested one, so a
  typed-over (reprint) number doesn't advance the counter. Single
  `UPDATE … WHERE next_number = $n RETURNING`.

### Tax maths (pure function, unit tested)

Per line, inclusive amount `A`, rate `r`:

- `taxable = round(A * 100 / (100 + r))`, `tax = A - taxable` (sums back exactly)
- Tax type resolution, in order:
  1. `client_billing.tax_type` if not `auto`
  2. no template GSTIN → `none`
  3. buyer state = therapist state → `cgst_sgst` (tax split in half; amounts are whole rupees, so an odd rupee goes to SGST)
  4. otherwise (other state, or outside India) → `igst`
- `none` → document title "Bill of Supply", no tax columns; otherwise "Tax Invoice"

Session line descriptions: "Therapy session — 12 Oct 2026, 4:00 pm" (in the
therapist's timezone). Non-session charges use `payment.note`, falling back to
"Charge — <date>". Pack purchase: "Session pack (N sessions)".

## 3. UI

### Template — `/settings`

- `src/lib/components/Settings/InvoiceTemplateSettings.svelte`
- Logo and signature uploads reuse the payment-QR upload path
  (`presignedPost` / `headObject` in `src/lib/server/storage.ts`, see the QR
  handling in `src/routes/(app)/settings/+page.server.ts`).

### Client billing — `/clients/[clientId]`

- `src/lib/components/Clients/ClientBillingDetails.svelte` — a card beside the
  existing profile fields, all seven fields editable.

### Generator — `/payments/invoice`

- `src/routes/(app)/payments/invoice/+page.server.ts` + `+page.svelte`
- Entry: "Generate invoice" button on the Payments tab.
- Step 1 — pick a client, or "Someone else" (Custom mode only; blank buyer
  fields to type in).
- Step 2 — pick a mode:
  - **Session** — list of the client's payments, pick one
  - **Weekly / Monthly** — defaults to the last full period (Mon–Sun / calendar
    month), ‹ › arrows to step
  - **Custom** — empty lines: description, amount, GST %; totals computed
- Step 3 — the invoice renders pre-filled. Every field is editable in place
  (plain inputs styled to look like the printed document). Tax type and rates
  can be changed per invoice; totals recompute live.
- "Print / Save as PDF" → calls `consumeInvoiceNumber`, then `window.print()`.

### Document — `src/lib/components/Invoices/InvoiceDocument.svelte`

- A4, `@media print` hides app chrome.
- Contents (GST rule 46): logo, seller name/address/GSTIN, invoice number and
  date, buyer name/address/GSTIN, place of supply (state name + code), lines
  (description, SAC, taxable value, rate, CGST/SGST/IGST, amount, Paid/Due),
  totals, amount in words, footer text, signature image + "Authorised
  signatory".
- Split into small pieces: `InvoiceHeader`, `InvoiceParties`,
  `InvoiceLines`, `InvoiceTotals`, `InvoiceFooter`.

## 4. Tests

- Unit: tax split (intra/inter state, outside India, `none`, overrides,
  rounding sums back exactly), GSTIN validation, weekly/monthly period bounds,
  amount in words.
- Integration: `buildInvoice` period selection (session-date vs created-date
  payments, paid + due both included); cannot build for another therapist's
  client/payment; `consumeInvoiceNumber` only bumps on the suggested number and
  two concurrent calls bump once each.

## Out of scope

- Client portal access of any kind
- Storing issued invoices / invoice history
- Credit notes, e-invoicing / IRN
- Automatic, scheduled or emailed invoices
- Non-INR / non-GST tax invoices

## Build order

1. Schema + migration (approval needed; user runs `db:migrate`)
2. `invoices.ts` + unit tests for tax maths, GSTIN, periods
3. Template settings (incl. logo/signature upload)
4. Client billing card
5. `InvoiceDocument` components
6. `/payments/invoice` generator + Payments tab button
7. Integration tests
