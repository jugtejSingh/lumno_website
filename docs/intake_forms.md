# Intake forms — plan

A therapist builds a form with a permanent public link. Anyone can fill it in, and the
therapist reads the responses in the app. From a response, the therapist can send a client
invite straight to the email address that was submitted.

## How it fits the existing code

- The public page follows the same pattern as `src/routes/outreach/[token]`: a token link with
  no login, and a 404 when the form is off or the token is unknown.
- **Send invite** reuses `addClient()` in `src/lib/server/clients.ts`. That function already
  handles the plan-limit check, the invite token and the invite email.

## 1. Schema (needs approval before writing)

Adds new tables. The migration is created with `npm run db:generate`, and the user applies it
with `npm run db:migrate`.

- **`intake_form`**
  - `id`, `therapistId` (FK → therapist, cascade)
  - `title`
  - `fields`: jsonb, `[{ id, label, type: 'short' | 'long' | 'choice', options?, required }]`
  - `publicToken`: unique, permanent (never expires)
  - `enabled`: boolean
  - `createdAt`, `updatedAt`
- **`intake_response`**
  - `id`, `formId` (FK → intake_form, cascade), `therapistId`
  - `name`, `email`
  - `answers`: jsonb, `[{ fieldId, label, value }]`
  - `clientId`: nullable FK → client (set null), filled in once the person is invited
  - `createdAt`

Each response stores a snapshot of the question labels it was answered against. Editing the
form later does not change what old responses show.

## 2. Server module: `src/lib/server/intakeForms.ts`

- Get, create and update a form, and toggle it on or off. Field parsing and validation follow
  the same approach as `parseClientFieldHeadings`.
- `submitResponse(token, formData)`
  - Name and email are always required, because the invite needs them.
  - Required fields, length caps and choice values are checked against the form.
  - Rate-limited with the existing `ratelimit`.
- `inviteFromResponse(therapistId, responseId, origin)`
  - Calls `addClient(name, email)`, then sets `response.clientId`.
  - If the response already has a client, it does nothing.
- `deleteResponse(therapistId, responseId)`

## 3. Public route: `src/routes/intake/[token]`

- `+page.server.ts`: the load function looks up the form by its token and returns a 404 when
  the form is off or unknown. The submit action calls `submitResponse`.
- `+page.svelte`: shows the form, then a thank-you state after submission.

## 4. App routes: `src/routes/(app)/intake`

- `+page`: the form builder (add, remove and reorder questions; copy the public link; on/off
  toggle) and the list of responses (name, email, date, invited or not).
- `[responseId]/+page`: shows the answers, with these actions:
  - **Send invite**, or "Invited ✓" with a link to the client profile once sent.
  - **Delete response**.
- Components:
  - `IntakeFieldEditor.svelte`
  - `IntakeResponseList.svelte`
  - `IntakeFormRenderer.svelte` (used by the public page)
- Add an "Intake" link to the app nav.

## 5. Tests

One integration test covers: submit → response stored → invite → client created → a second
invite does nothing.

## Defaults (can change)

- One form per therapist. The schema already supports several forms; supporting more only
  needs a list page.
- No email to the therapist when a new response arrives. Add it later if wanted.
- No file uploads.
- Responses can hold sensitive health information. Only the owning therapist can read them,
  and the delete action is included.
