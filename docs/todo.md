# TODO

## Auth

- Double-check therapist vs client login: therapists always get email verification
  unless they use OAuth; clients never get verification — clicking the invite email
  link is verification enough.
- No password-reset flow exists yet: no `forgetPassword` / `sendResetPassword`
  config in `auth.ts`, no UI. When built it needs a third email through
  `src/lib/server/email.ts` `sendEmail`.

## Email

- Write real subject lines. Currently placeholders: "Verify your email" in
  `auth.ts`, "You've been invited" in `clients.ts`. Should include the
  practice / company name once that exists.

## Booking & calendar

- Double-check the payment and calendar booking system end to end.
- Add a "reach home" buffer, alongside the existing buffer. Depends on being able
  to split in-person and online days first.
- Couples therapy: allow a second attendee (client or guest) on the same
  appointment / Meet invite. `appointment.clientId` is a single FK today, so this
  needs a client-list-per-appointment relation, not just another email param on
  the Meet-creation call.

## Organizations & Billing (Razorpay)

Full design + build checklist: **`docs/billing-and-organizations.md`**.

Short version: schema for `organization` / `subscription` / plan tables exists;
`createOrganization` exists but must be **reworked** — an org can't be created
without going through org-plan checkout (no free-tier org), and cancelling the
org sub disbands the org. Also not built: org admin UI, org client view, the
free-tier downgrade (permanently deactivate over-limit clients — never delete),
one cancel button (cycle-end only), `getEffectivePlan` returning the higher of
personal/org tier so a joiner keeps their personal plan until it lapses, halt
grace, org disband + the member's extra grace week, Razorpay checkout + webhook,
and wiring `usageLimit()` guards into `addClient` / booking.

### Future

- **Non-therapist org admin.** Today the org owner is always one of its
  therapists (`organization.ownerTherapistId`). If a practice ever needs an
  office manager who administers billing / seats without being a therapist,
  that needs a role on org membership (a join table or an `orgRole` column),
  not just the single owner FK. YAGNI until a real practice asks.