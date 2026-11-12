# Client tags — removed (2026-11-12)

## What it was

Therapists could add free-text tags to a client (e.g. "anxiety", "weekly") on the
Edit client form. They were typed as chips, posted as one comma-separated `tags`
field, split/trimmed by the `update` action in `clients/[clientId]/+page.server.ts`,
and shown as chips under each client on the `/clients` list. New clients always
started with no tags.

Stored in `client.tags` (`text[]`, not null, default `{}`) — see
`src/lib/server/db/users.schema.ts`. Never shown to clients (the portal allow-list
excludes it).

## Why it was removed

Hard to explain to therapists and didn't do anything: no filtering, search or
reporting used them. Client Profile Fields (Settings) cover the "note things about
every client" need.

## Current state

- No UI, form field, action or server function reads or writes client tags.
- **The `client.tags` column is intentionally kept**, so tags already saved in prod
  aren't lost. New rows get the default `{}`.
- Not to be confused with therapist specialty tags (`therapist.tags`, Settings →
  specialties, Community page) — those are still in use.

## If we want to drop the column later

Remove `tags` from the `client` table in `users.schema.ts`, run `npm run db:generate`,
review the migration, then `npm run db:migrate`. This permanently deletes existing
client tag data.
