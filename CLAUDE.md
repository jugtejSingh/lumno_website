# therapist_website

## Database schema changes

The app is in prod. Schema changes go through migrations: `npm run db:generate`
to create a migration file after editing the schema, `npm run db:migrate` to
apply it. Do not use `db:push` anymore.
