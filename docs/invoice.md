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
- **Auto-created when the payment is paid, per client, off by default**
  (`client_billing.auto_invoice`, therapist-only). When on, a Razorpay capture
  or the therapist marking it paid issues the invoice — whether or not it gets
  emailed. Otherwise, and always as a fallback, the therapist issues it by hand
  (also early, for a due payment).
- **Invoices are only ever sent by email, never WhatsApp.** WhatsApp reminders
  stay as they are; no invoice, link or PDF goes through `whatsapp.ts`.
- **Emailing is per client, off by default** (`client_billing.auto_send`). Off
  means the invoice is still created and stored, just not sent; the therapist
  can send it manually later.
- **Billing details: client or therapist.** The client (portal Details page) or
  the therapist (client page) can edit the client's billing details
  (`client_billing`). Neither the client nor the portal can touch the
  therapist's invoice settings, line items or `auto_send`.
- **Stored permanently.** GST records must be kept (~6 years) and an issued
  invoice can't be deleted, only cancelled. Each invoice stores a full snapshot
  of what was issued, so later edits to settings, client details or the payment
  never change it. To correct one: cancel and reissue.
- **PDF is regenerated from the snapshot**, not stored — no sensitive files
  sitting in storage.
- **Kept, then re-sent or downloaded any time.** Every invoice stays in the
  table. The therapist can email it again or download it from history; the
  client can download their own invoices from the portal.
- **Download happens in the browser.** The page renders `InvoiceDocument` from
  the snapshot and the browser saves it as a PDF (`window.print()` + an A4
  print stylesheet). The server renders no PDF for a download. Server PDFs are
  only for email attachments.
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

Format: `{prefix}/{financial year}/{sequence}`, e.g. `ANV/2026-27/0013`, or
`2026-27/0013` with no prefix. Sequence is padded to 4 digits.

- The financial year (April–March) comes from the issue date, so the series
  restarts at `0001` every April without the therapist touching anything.
- `number_prefix` is the therapist's own code. Letters, digits, `-` and `/`
  only, at most 3 characters: `/2026-27/0013` is 13, and GST caps the full
  number at 16.
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
| `default_gst_rate` | integer percent, default `18`, typed in by the therapist (no slab list — rates change) |
| `number_prefix`    | nullable, e.g. `ANV`                                |
| `next_number`      | integer, default `1`                                |
| `next_number_year` | nullable, e.g. `2026-27`                            |
| `footer`           | nullable — bank/UPI details, terms, thank-you line  |
| `logo_key`         | nullable S3 key                                     |
| `signature_key`    | nullable S3 key                                     |
| `extra_fields`     | jsonb `{label, value}[]`, default `[]`              |

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
| `auto_send`     | boolean, default `false` — email this client's invoices on payment; therapist-only toggle |
| `auto_invoice`  | boolean, default `false` — issue an invoice when one of this client's payments is paid; therapist-only toggle |

### `invoice` — one row per payment, kept permanently

| column                                       | notes                                                        |
| -------------------------------------------- | ------------------------------------------------------------ |
| `id`                                         | PK                                                           |
| `therapist_id`                               | → therapist, **restrict** — GST records outlive the account  |
| `payment_id`                                 | **unique** → payment, **set null**                           |
| `client_id`                                  | → client, set null; null for a `customName` payment          |
| `financial_year`, `sequence`, `number`       | see Invoice numbers; `number` stored as issued (prefix may change later) |
| `issue_date`                                 | date                                                         |
| `status`                                     | enum `issued` / `cancelled`                                  |
| `tax_type`                                   | enum `cgst_sgst` / `igst` / `none` — resolved at issue, never `auto` |
| `data`                                       | jsonb snapshot of the invoice as issued (`InvoiceDraft` shape) |
| `logo_key`, `signature_key`                  | nullable — the settings images as issued; settings never delete a key an invoice uses |
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

### Line descriptions

Picked from what the payment is linked to — no new payment column. Dates are
the session's (not the payment's), in the therapist's timezone. Always
editable before issuing; fixed in the snapshot after.

| Case | Recognised by | Description |
| --- | --- | --- |
| Session | first payment on a `confirmed` appointment | "Therapy session — 12 Oct 2026, 4:00 pm" |
| Cancellation | payment on a `cancelled` appointment (the kept paid charge, or the fee row) | "Cancellation fee — session of 12 Oct 2026, 4:00 pm" |
| Reschedule | later payment on an appointment with `rescheduledFromId` set (the moved original stays a Session line at the new date) | "Rescheduling fee — session of <original date>" |
| Pack | `packId` set | "Session pack (N sessions)" |
| One-off | no appointment, no pack | `payment.note`, else "Charge — <date>" |

- ponytail: an extra charge on a rescheduled session is also labelled a
  rescheduling fee; editable before issue, add a payment kind column if it
  matters.

### Refunds

A paid session later cancelled keeps its invoice at the full amount. The refund
(paid − fee) is shown on `/payments` as today, outside invoices. Reducing an
issued invoice needs a credit note — out of scope for now.

## PDF

### Download — browser

`/invoice/[id]` (therapist) and the portal's invoice page (client) render
`InvoiceDocument` from the snapshot. A Download button calls `window.print()`;
an `@media print` + `@page { size: A4; margin: 0 }` stylesheet hides everything
but the invoice, so "Save as PDF" gives the same A4 page. No server work, no
rate limit.

### Email attachment — server-side Chromium

Only for email, since no browser is involved in an auto-send.
`InvoiceDocument` is rendered to HTML with `render` from `svelte/server`, then
turned into an A4 PDF by headless Chromium.

- Dependencies: `puppeteer-core` (drives Chromium) + `@sparticuz/chromium`
  (Chromium build for serverless). Locally on Windows, point Puppeteer at the
  installed Chrome (`dev` from `$app/environment`).
- Endpoint: `POST /api/internal/invoice-email` (`src/lib/server/invoiceEmail.ts`),
  called server-to-server by `requestInvoiceEmail` with `Bearer CRON_SECRET`;
  exempt from the per-IP rate limit. Config
  `export const config = { memory: 2048, maxDuration: 30 }` —
  2 GB is the plan max and the fastest option (CPU scales with memory). The
  different config gives it its own function, so the rest of the app doesn't
  carry the ~60 MB Chromium bundle.
- Expect ~3–5 s on a cold start, ~1 s warm. Launch and close per request.
- Fonts, logo and signature are embedded in the HTML as data URIs so Chromium
  waits on no network; `page.setContent(html, { waitUntil: 'load' })`. The font
  is Nunito (OFL), `src/lib/server/fonts/*.woff2`, inlined with `?inline`; its
  latin-ext subset carries `₹`. The invoice components use
  `<svelte:options css="injected" />` so `render` output includes their styles.
- File tracing: `@sparticuz/chromium` reads its `bin/*.br` files from disk at
  runtime rather than importing them, so Vercel's tracing can miss them — the
  symptom is "Could not find Chromium" in prod only. Check the first deploy.
  If it happens, switch to `@sparticuz/chromium-min` and download the pack at
  cold start from a URL hosted in Vercel Blob.
- Version pinning: each `@sparticuz/chromium` release is built for one
  Chromium version, and each `puppeteer-core` release targets one Chromium
  version. Pick the pair from the Sparticuz compatibility table, pin both
  exactly (no `^`), and upgrade them together. Current pair:
  `puppeteer-core@25.11.0` (Chromium 153) + `@sparticuz/chromium@153.0.0`.
- No third-party PDF APIs — invoices carry client names and session dates.

## Sending

- Email via Resend (`src/lib/server/email.ts`), PDF attached.
- Creation: when a payment is paid and the client has `auto_invoice` on,
  `autoIssueInvoice` runs right after the paid write (no PDF there — Chromium is
  too slow for the webhook). It never blocks or undoes the payment: a refusal
  or error is logged and the therapist can issue by hand.
- Automatic send: only when that client's `client_billing.auto_send` is on and
  the therapist's settings are complete. A separate sender renders the PDF,
  emails it and sets `sent_at`. The cron never sends email itself (it would
  block); it only finds auto-send invoices with `sent_at` null and hands them
  to the sender to retry.
- Manual send: from `/invoice` or invoice history (any issued invoice, any
  time — every send updates `sent_to` / `sent_at`), a required, editable
  "Send to" email field,
  pre-filled with `billing_email`, else `client.email`, else empty (a one-off
  `customName` invoice has no email on file). Lines like "Therapy session" may
  reach a company's accounts team — the therapist sees the recipient and can
  edit descriptions before sending.
- Auto-send recipient is `billing_email`, falling back to `client.email`.
- Manual sends are rate-limited to **3 per hour per invoice**: a new
  `invoiceEmailRatelimit` in `src/lib/server/rateLimit.ts`
  (`slidingWindow(3, '1 h')`, keyed by invoice id), same pattern as
  `phoneOtpRatelimit`. Auto-send and cron retries don't count against it.
- Every send re-checks the invoice belongs to the therapist.
- Clients can't email invoices — download only.

## UI

- **`/invoice`** (built) — form (`InvoiceForm`) beside a live read-only A4
  preview (`InvoiceDocument`), components in `src/lib/components/Invoices/`.
  Currently starts blank and saves nothing; next it fills from a payment +
  settings + client billing, and issues/downloads/sends, with a "Send to"
  email field for manual sends.
- **Invoice history** — the therapist's issued invoices: view, Download
  (browser), Email (with "Send to" field), cancel.
- **Client portal invoices** — the client's own invoices (`invoice.client_id`
  = them), view + Download only. Cancelled ones show as cancelled. One-off
  `customName` invoices have no client, so never appear here.
- **Settings** — `/settings/invoices` (linked from /settings for INR practices):
  `invoice_settings` form incl. logo/signature upload, same as the payment-QR
  upload (file in the form post → `putObject`). A replaced or removed image is
  deleted after save only if no invoice uses it (`invoice.logo_key` /
  `signature_key`), so issued invoices keep their original logo and signature.
- **Client page** — billing card for `client_billing` (INR only), including
  tax type and GST rate. The per-client "Email invoices automatically" toggle
  (off by default) arrives in step 6 with the sending it controls.
- **Client portal Details page** — the client edits their own billing details:
  name/company, email, address, state, GSTIN and extra fields. Tax type, GST
  rate and `auto_send` are therapist-only, so a client can't set themselves to 0%.
- **Payments tab** — per-payment link to its invoice / "Issue invoice".
- Not linked in the sidebar yet; the INR check comes with the first real flow.

## Tests

- Unit (done for tax maths): GSTIN validation, financial-year calculation,
  number formatting/padding, amount in words.
- Integration: numbering (new year resets, back-dated year, editable
  `next_number`, duplicate rejected, two concurrent issues get different
  numbers); one invoice per payment (webhook retry); invoice survives client
  deletion; cannot issue/view another therapist's invoice; invoice is created
  with `auto_send` off but not sent; a client can edit only their own billing
  details and cannot set tax type, GST rate or `auto_send` (done); a client can view only their own
  invoices; a 4th manual email of one invoice within an hour is refused.

## To fix later

From review — not done yet:

- **Cancel vs credit note.** Cancelling is allowed, no credit note issued right now, will be added in later, this is for sessions 
    are pre-paid and have been cancelled
- **Advance payments.** Money taken before the session is technically a
  receipt voucher, with the invoice due at supply. Issuing at payment is usually
  accepted — confirm with a CA.

## Out of scope

- Combined / clubbed invoices
- Credit notes, e-invoicing / IRN
- Non-INR / non-GST invoices

## Build order

1. ✅ Done — Schema + migration (`0006_foamy_spencer_smythe`, applied)
2. ✅ Done — Invoice settings form (`/settings/invoices`)
3. ✅ Done — Client billing card (client page) + portal billing details;
   auto-send toggle deferred to step 6
4. ✅ Done — Issue invoices from `/invoice?payment=` (fill from payment,
   numbering, save), `/invoice/[id]` view + cancel, `/invoices` history
   - ✅ 4b. Auto-create the invoice when a payment is paid (`client_billing.auto_invoice`,
     off by default; migration `0007_open_magik`)
5. ✅ Done — Browser download (`window.print()` + A4 print stylesheet) on
   `/invoice/[id]` and the portal's `/portal/invoices` + `/portal/invoices/[id]`;
   invoices keep the logo/signature keys they were issued with (migration
   `0008_absent_mach_iv`); cancelled invoices print a CANCELLED mark
6. Server PDF, email, auto-send on payment, cron retry, rate limit
   - ✅ 6a. Server PDF + manual "Email invoice" on `/invoice/[id]` (Send to
     field, 3 per hour per invoice, sets `sent_to` / `sent_at`)
   - 6b. Auto-send on payment (`client_billing.auto_send`) + cron retry
7. Integration tests alongside each step
