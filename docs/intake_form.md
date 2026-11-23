# Intake form — plan

Status: built 2026-11-21 (migration `drizzle/0007_violet_molecule_man.sql` generated, not yet applied). Differences from the original plan are marked **(changed)**.

A therapist builds their own intake form (any number of questions; they write the
question and pick the answer type), shares one permanent link, reads the responses,
gets an email each time someone fills it in, and imports a respondent as a client with
one button when the form collected an email.

## Data

One migration (`npm run db:generate`; the user runs `npm run db:migrate`).

### `intake_form` — one per therapist

| column        | type                     | notes                                                    |
|---------------|--------------------------|----------------------------------------------------------|
| `id`          | text pk                  |                                                          |
| `therapist_id`| text, unique, fk cascade | one form per therapist; drop the unique constraint for multiple forms |
| `title`       | text                     |                                                          |
| `intro`       | text, nullable           | shown above the questions                                |
| `questions`   | jsonb                    | list of questions, shape below                           |
| `share_token` | text, unique, nullable   | null = link off. No expiry — permanent until regenerated |
| `updated_at`  | timestamp                |                                                          |

### `intake_response`

| column               | type                         | notes                                          |
|----------------------|------------------------------|------------------------------------------------|
| `id`                 | text pk                      |                                                |
| `therapist_id`       | text, fk cascade             |                                                |
| `intake_form_id`     | text, not null, fk → `intake_form.id` cascade | **(changed, was `form_id`)** which form this answers. Uses the form's id, which never changes, so regenerating the share link keeps old responses connected |
| `questions_snapshot` | jsonb                        | questions as they were when answered           |
| `answers`            | jsonb                        | keyed by question id                           |
| `email`              | text, nullable               | pulled from the email question, for import     |
| `name`               | text, nullable               | pulled from the name question                  |
| `client_id`          | text, nullable, fk set null  | set once imported                              |
| `created_at`         | timestamp                    |                                                |

The snapshot keeps old responses readable after the therapist edits or deletes questions.

## Question shape

```ts
type IntakeQuestion = {
	id: string;            // stable, generated when the question is added
	label: string;         // the question itself
	description?: string;  // optional helper text shown under the label
	type: IntakeQuestionType;
	required: boolean;
	choices?: string[];    // only for single_choice / multiple_choice, and required there
};
```

## Answer types

| type              | answer stored as | example                                                       |
|-------------------|------------------|---------------------------------------------------------------|
| `short_text`      | string           | "Pronouns"                                                    |
| `long_text`       | string           | "Describe what you'd like to work on"                         |
| `single_choice`   | string           | "Preferred session type" → Online / In person / Either        |
| `multiple_choice` | string[]         | "What brings you here?" → Anxiety / Depression / Grief / Other |
| `yes_no`          | boolean          | "Have you had therapy before?"                                |
| `date`            | `YYYY-MM-DD`     | "Date of birth"                                               |
| `number`          | number           | "Age"                                                         |
| `email`           | string           | "Your email"                                                  |
| `phone`           | string           | "Your phone number"                                           |
| `name`            | string           | "Your full name"                                              |

Special types:

- **email** — at most one per form. Its presence is what makes a response importable.
  Validated with the existing `isValidEmail`.
- **phone** — validated with the existing `parsePhone`.
- **name** — at most one per form. Fills `client.name` on import. If the form has no name
  question, fall back to the email's local part.

### Per-type options

Only **choices** (for the two choice types) is in scope. Everything else is a fixed
server-side cap, not a therapist setting:

| cap                         | value  |
|-----------------------------|--------|
| questions per form          | 50     |
| choices per question        | 20     |
| label / choice length       | 200    |
| description length          | 500    |
| short text answer           | 200    |
| long text answer            | 5000   |

Deferred (add if a therapist asks): placeholder text, per-question character limits,
max picks for multiple choice, number min/max, past-only / future-only dates.

## Server modules

- `src/lib/server/intakeQuestions.ts` — pure validation of question definitions and of
  submitted answers, following the same approach as `parseClientFieldHeadings`. Covered by
  vitest unit tests.
- `src/lib/server/intakeForm.ts` — get/save the therapist's one form, enable /
  regenerate / disable link.
- `src/lib/server/intakeResponses.ts` — submit, list, get, delete, import.
- `src/lib/server/intakeEmails.ts` — the "new intake response" email to the therapist.

## Routes

Intake gets its own entry in the sidebar ("Intake", between Clients and Payments in
`src/routes/(app)/+layout.svelte`), separate from Clients.

- `(app)/intake` — the main intake page:
  - A big **Copy link** button that copies the public form link (**(changed)** `/forms/[token]` — `/intake/[token]` would clash with `(app)/intake/[responseId]`).
  - The list of everyone who has filled in the form: name, email, date, imported or not.
    Each row opens that response.
  - An **Edit form** button that goes to `(app)/intake/edit`.
- `(app)/intake/edit` — the builder: title, intro, and questions (add / reorder / remove;
  label, description, type, required, choices). Also turns the link on/off and regenerates it.
- `(app)/intake/[responseId]` — read a response; **Import as client** and **Delete**.
- **(changed)** `/forms/[token]` — public form, no login, then a thank-you state after submitting.
  Uses the existing `rateLimit.ts`. Off and unknown tokens return the same 404, like
  `/outreach/[token]`.
- Add an "Intake" link to the app nav.

## Therapist email on each response

When a response is saved, email the therapist (their `user.email`):

- Subject: "New intake response from {name}" (or "from {email}", or "New intake response"
  if neither was asked).
- Body: who it's from and when, plus a **View response** button to `(app)/intake/[responseId]`.
- **No answers in the email.** Intake answers are often health information; inboxes get
  forwarded and scanned. The answers stay behind login.
- Best-effort, never throws — a failed send is logged and the response is still saved
  (same contract as `bookingEmails.ts`).
- Always sent — no toggle in this plan.

## Import

One button calls the existing `addClient()` in `clients.ts`, so plan cap, duplicate-email
and self-invite checks all still apply. On success, set `intake_response.client_id`; the
button becomes "View client". The client page links back to their intake response.
If the response already has a client, import does nothing (no second client, no second
invite).

## Tests

- Unit (vitest): `intakeQuestions.ts` — question definitions and answer validation.
- Integration: submit → response stored → import → client created → second import does
  nothing.

## Components

- `QuestionEditor.svelte` — edit one question in the builder.
- `QuestionField.svelte` — render one question by type on the public form.
- `AnswerList.svelte` — read-only view of a response.

## Needs explicit approval (safety-critical)

1. New tables + migration.
2. A public, unauthenticated route that writes to the DB — rate-limited, capped as above.
3. Outward-facing email: the therapist notification on every response.
4. Import sends the normal client invite email.

## Decided

Import sends the client invite email immediately when the therapist clicks **Import as
client** — same as adding a client today.

## Future: multiple forms per therapist

Not built now. The only parts done up front are `intake_response.intake_form_id` (above) and a form `id` separate from its share token, so the
switch is one migration (drop the unique on `intake_form.therapist_id`) plus UI, with no data backfill.

What's already ready:

- Each form has its own `share_token`, so each form has its own public link.
  `/forms/[token]` doesn't change.
- Import, validation, the question snapshot and the therapist email all work per response.

What would change:

1. **Schema:** drop the `unique` on `intake_form.therapist_id`; add
   `intake_form.archived_at`.
2. **Archive, don't delete:** a real delete would cascade and wipe responses. Archiving kills
   the link and keeps the responses readable.
3. **Cap:** e.g. 20 forms per therapist.
4. **Routes:**
   - `/intake`: list of forms, each with its own Copy link and response count, plus
     **New form**.
   - `/intake/[formId]`: that form's responses, with Copy link and Edit form.
   - `/intake/[formId]/edit`: the builder.
   - `/intake/[formId]/responses/[responseId]`: one response.
5. **Email:** put the form's title in the subject, e.g. "New response to *Couples intake*
   from Priya".

## Skipped (add when needed)

File uploads, conditional questions, the deferred per-type
options above.
