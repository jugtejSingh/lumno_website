# GST invoices

Therapists who bill companies need a GST invoice the company can use for input
tax credit. Every payment gets one invoice. Invoices are stored so the
therapist can look them up later, rendered to PDF on the server, and can be
emailed — automatically when a payment is paid, if the therapist turns that on.

## Decisions

- **India only.** Feature shows only when `therapist.currency === 'INR'`.
- **All plans.** No `THERAPIST_PLAN_USAGE` key.
- **One invoice per payment.** No combined/clubbed invoices. A one-off invoice
  for someone who isn't a client is a payment with `customName` (already
  supported by `payment`), so every invoice comes from a payment.
- **Created when the payment is paid** (Razorpay capture or the therapist
  marking it paid). The therapist can also issue one early for a due payment.
- **Stored permanently.** GST records must be kept (~6 years) and an issued
  invoice can't be deleted, only cancelled. Each invoice stores a full snapshot
  of what was issued, so later edits to settings, client details or the payment
  never change it. To correct one: cancel and reissue.
- **PDF is regenerated from the snapshot**, not stored — no sensitive files
  sitting in storage.
- **Amounts are GST-inclusive.** `payment.amount` is what the client pays; the
  invoice back-calculates the taxable value. Nothing about how payments are
  created, charged or paid changes.

## SAC code

SAC (Services Accounting Code) is GST's classification number for services
(HSN is the equivalent for goods). It must appear on a tax invoice:

- Turnover up to ~₹5 crore: at least 4 digits on B2B invoices.
- Above that: 6 digits.

Default is `9993` — "human health and social care services", the group therapy
falls under. The 6-digit code commonly used for psychologists/counsellors is
`999319` ("other human health services"); not verified, the therapist should
confirm with their accountant.

Set once in invoice settings (`sac_code`), copied onto each line, editable per
line so a non-therapy charge (e.g. a workshop) can carry its own code.

Some healthcare services are GST-exempt depending on the practitioner's
registration (e.g. clinical psychologists) — those therapists should issue a
Bill of Supply (no GSTIN / tax type `none`). Also one to confirm with an
accountant.

## Invoice numbers

Format: `{prefix}/{financial year}/{sequence}`, e.g. `ANV/2026-27/013`, or
`2026-27/013` with no prefix. Sequence is padded to 3 digits.

- The financial year (April–March) comes from the issue date, so the series
  restarts at `001` every April without the therapist touching anything.
- `number_prefix` is the therapist's own code. Letters, digits, `-` and `/`
  only; the full number must stay within GST's 16-character limit (so prefixes
  of ~3–4 characters).
- `next_number` is editable, so a therapist who wrote invoices by hand (or is
  moving from another tool) can continue from e.g. 13.

Issuing, in one transaction with the therapist's `invoice_settings` row locked
(`SELECT … FOR UPDATE`):

1. Financial year `Y` from the issue date.
2. `Y = next_number_year` (or that is null) → use `next_number`. A later year
   → start at 1. An earlier year (back-dated) → highest sequence issued in `Y` + 1.
3. Insert the invoice; for the current/new year set `next_number = sequence + 1`
   and `next_number_year = Y`.

`unique(therapist_id, financial_year, sequence)` guarantees no number is used
twice; if the therapist sets `next_number` below one already issued, they get a
"number already used" error instead of a duplicate.

## Tables

New file `src/lib/server/db/invoices.schema.ts`, exported from `schema.ts`. One
migration, additive only — no existing table changes.
Flow: edit schema → `npm run db:generate` → user runs `npm run db:migrate`.

Core fields reuse what the app already has; the new tables hold only the
invoice-specific extras, plus `extra_fields` for anything else a therapist or
company wants printed (PAN, registration number, employee ID, PO number…).

### `invoice_settings` — one row per therapist

| column             | notes                                               |
| ------------------ | --------------------------------------------------- |
| `therapist_id`     | PK → therapist, cascade                             |
| `legal_name`       | nullable; falls back to `user.name`                 |
| `address`          | required                                            |
| `state_code`       | required, 2-digit GST state code                    |
| `gstin`            | nullable — none means a Bill of Supply              |
| `sac_code`         | default `9993`                                      |
| `default_gst_rate` | integer percent, default `18`                       |
| `number_prefix`    | nullable, e.g. `ANV`                                |
| `next_number`      | integer, default `1`                                |
| `next_number_year` | nullable, e.g. `2026-27`                            |
| `footer`           | nullable — bank/UPI details, terms, thank-you line  |
| `logo_key`         | nullable S3 key                                     |
| `signature_key`    | nullable S3 key                                     |
| `extra_fields`     | jsonb `{label, value}[]`, default `[]`              |
| `auto_send`        | boolean, default `false` — email invoices on payment |

### `client_billing` — one row per client that needs GST invoices

| column          | notes                                                          |
| --------------- | -------------------------------------------------------------- |
| `client_id`     | PK → client, cascade                                           |
| `company_name`  | nullable; falls back to `client.name`                          |
| `billing_email` | nullable; falls back to `client.email`                         |
| `address`       | billing address                                                |
| `gstin`         | nullable                                                       |
| `state_code`    | nullable; from the GSTIN's first 2 digits, else matched from `client.state` (free text) |
| `tax_type`      | enum `auto` / `cgst_sgst` / `igst` / `none`, default `auto`    |
| `gst_rate`      | nullable integer; null = `invoice_settings.default_gst_rate`   |
| `extra_fields`  | jsonb `{label, value}[]`, default `[]`                         |

### `invoice` — one row per payment, kept permanently

| column                                       | notes                                                        |
| -------------------------------------------- | ------------------------------------------------------------ |
| `id`                                         | PK                                                           |
| `therapist_id`                               | → therapist, cascade                                         |
| `payment_id`                                 | **unique** → payment, **set null**                           |
| `client_id`                                  | → client, set null; null for a `customName` payment          |
| `financial_year`, `sequence`, `number`       | see Invoice numbers; `number` stored as issued (prefix may change later) |
| `issue_date`                                 | date                                                         |
| `status`                                     | enum `issued` / `cancelled`                                  |
| `data`                                       | jsonb snapshot of the invoice as issued (`InvoiceDraft` shape) |
| `taxable_paise`, `tax_paise`, `total_paise`  | integers, for the list view                                  |
| `sent_to`, `sent_at`                         | nullable; `sent_at` null = not sent yet                       |
| `created_at`                                 |                                                              |

- `payment_id` unique: one invoice per payment, and a retried Razorpay webhook
  can't create a second.
- Set null rather than cascade: deleting a client already cascades away their
  payments (`payment.client_id`); the invoices must survive that as GST records.

## Tax maths — `src/lib/invoice.ts` (built, unit tested)

Shared by the browser preview and the server. All money in paise.

- Per line, inclusive amount `A`, rate `r`: `taxable = round(A * 100 / (100 + r))`,
  `tax = A - taxable` (sums back exactly).
- Tax type, in order:
  1. explicit choice (`client_billing.tax_type`, or changed on the invoice) if not `auto`
  2. no seller GSTIN → `none`
  3. buyer state = seller state → `cgst_sgst` (odd paisa goes to SGST)
  4. otherwise (other state, outside India) → `igst`
- `none` → title "Bill of Supply", no tax columns; otherwise "Tax Invoice".

Line descriptions: "Therapy session — 12 Oct 2026, 4:00 pm" (therapist's
timezone). Non-session charges use `payment.note`, falling back to
"Charge — <date>". Pack purchase: "Session pack (N sessions)".

## PDF — server-side Chromium

`InvoiceDocument` is rendered to HTML with `render` from `svelte/server`, then
turned into an A4 PDF by headless Chromium.

- Dependencies: `puppeteer-core` (drives Chromium) + `@sparticuz/chromium`
  (Chromium build for serverless). Locally on Windows, point Puppeteer at the
  installed Chrome (`dev` from `$app/environment`).
- Endpoint config: `export const config = { memory: 2048, maxDuration: 30 }` —
  2 GB is the plan max and the fastest option (CPU scales with memory). The
  different config gives it its own function, so the rest of the app doesn't
  carry the ~60 MB Chromium bundle.
- Expect ~3–5 s on a cold start, ~1 s warm. Launch and close per request.
- Fonts (incl. `₹`), logo and signature are embedded in the HTML so Chromium
  waits on no network; `page.setContent(html, { waitUntil: 'load' })`.
- If Vercel's file tracing drops Chromium's `bin` files, switch to
  `@sparticuz/chromium-min` with the pack hosted in Vercel Blob.
- No third-party PDF APIs — invoices carry client names and session dates.

## Sending

- Email via Resend (`src/lib/server/email.ts`), PDF attached.
- Automatic: when a payment is paid and `invoice_settings.auto_send` is on, the
  invoice row is created in the same transaction that marks the payment paid
  (no PDF there — Chromium is too slow for the webhook). A separate step renders
  the PDF, sends it and sets `sent_at`; the existing cron retries rows with
  `sent_at` null.
- Auto-send only for clients with a `client_billing` row and a therapist with
  complete settings.
- Recipient is `billing_email`, falling back to `client.email`. Lines like
  "Therapy session" may reach a company's accounts team — the therapist must
  see who it goes to and be able to edit descriptions before a manual send.
- Rate-limited, and every send re-checks the invoice belongs to the therapist.

## UI

- **`/invoice`** (built) — form (`InvoiceForm`) beside a live read-only A4
  preview (`InvoiceDocument`), components in `src/lib/components/Invoices/`.
  Currently starts blank and saves nothing; next it fills from a payment +
  settings + client billing, and issues/downloads/sends.
- **Invoice history** — the therapist's issued invoices, view/download/cancel.
- **Settings** — `invoice_settings` form incl. logo/signature upload (reuse the
  payment-QR upload path: `presignedPost` / `headObject` in
  `src/lib/server/storage.ts`).
- **Client page** — billing card for `client_billing`.
- **Payments tab** — per-payment link to its invoice / "Issue invoice".
- Not linked in the sidebar yet; the INR check comes with the first real flow.

## Tests

- Unit (done for tax maths): GSTIN validation, financial-year calculation,
  number formatting/padding, amount in words.
- Integration: numbering (new year resets, back-dated year, editable
  `next_number`, duplicate rejected, two concurrent issues get different
  numbers); one invoice per payment (webhook retry); invoice survives client
  deletion; cannot issue/view another therapist's invoice.

## To fix later

From review — not done yet:

- **Place of supply fallback (code bug).** `resolveTaxType` in
  `src/lib/invoice.ts` returns `igst` when the buyer has no state. Unregistered
  recipient with no known state → place of supply is the supplier's state →
  `cgst_sgst`. Preview's place of supply should fall back the same way. Add a
  unit test.
- **`invoice.therapist_id` → restrict, not cascade.** GST records must be kept
  72 months; deleting a therapist must not wipe their invoices. (No therapist
  delete flow exists today.)
- **Store the document type.** Snapshot the *resolved* tax type (never `auto`)
  and add a `tax_type` column on `invoice`, so a therapist registering for GST
  later can't change old invoices from Bill of Supply to Tax Invoice.
- **16-character number limit.** Prefix max 4 characters, and check the full
  number server-side at issue time (sequences past 999 grow it).
- **Cancel vs credit note.** Cancelling is only valid before the invoice is
  reported in a GST return; after that a credit note is needed. Credit notes
  stay out of scope, but `status` may need a credit-note type later.
- **Unregistered client, ₹50,000+.** Name, address and state are mandatory —
  enforce at issue time.
- **GSTIN validation.** 15-character format, and first 2 digits must match
  `state_code`.
- **Advance payments.** Money taken before the session is technically a
  receipt voucher, with the invoice due at supply. Issuing at payment is usually
  accepted — confirm with a CA.
- **Exemption note in the UI.** Some therapy services are GST-exempt depending
  on qualification/registration; hint at it in settings beside GSTIN / tax type.

## Open question

- Who fills in a client's billing details? Suggested: the client in the
  portal's Details page, the therapist can edit on the client page.

## Out of scope

- Combined / clubbed invoices
- Credit notes, e-invoicing / IRN
- Non-INR / non-GST invoices

## Build order

1. Schema + migration (approval needed; user runs `db:migrate`)
2. Invoice settings form
3. Client billing card
4. Issue invoices from `/invoice` (fill from payment, numbering, save) + history
5. Server PDF + download
6. Email, auto-send on payment, cron retry
7. Integration tests alongside each step
