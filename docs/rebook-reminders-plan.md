# Rebook Reminders — Implementation Plan

Nudge clients by email when they've gone quiet: no session completed in the last N days,
**and no future session already booked**. Escalating ladder: 4 days → 2 weeks → 1 month,
then repeats monthly. Runs on the existing daily cron. Fully additive — reuses the email
and cron infra already in the codebase, no new dependencies.

## Status

- [x] `client.rebookReminderStage` (int, default 0) — ladder position: 0 none, 1 sent the
      4-day nudge, 2 sent the 2-week nudge, 3 sent the 1-month nudge.
- [x] `client.lastRebookReminderAt` (timestamp) — throttle for the monthly repeat once at
      stage 3.
- [x] `therapistSettings.sendRebookReminderEmails` (boolean, default true) — on/off toggle,
      same pattern as `sendSessionReminderEmails` / `sendPaymentReminderEmails`.
- [ ] Everything below.

## 1. Query: who's due a nudge

New function in `src/lib/server/reminderEmails.ts`, same shape as `sendPaymentReminders`'
`owedByClient` query — a `client` select with a correlated subquery, joined to
`therapist` → `user` → `therapistSettings`:

```ts
const rows = await db
	.select({
		clientId: client.id,
		clientEmail: client.email,
		clientName: client.name,
		stage: client.rebookReminderStage,
		lastReminderAt: client.lastRebookReminderAt,
		therapistName: user.name,
		therapistEmail: user.email,
		lastSessionAt: sql<Date | null>`(
			select max(${appointment.startAt}) from ${appointment}
			where ${appointment.clientId} = ${client.id}
				and ${appointment.startAt} <= now()
				and ${appointment.status} != 'cancelled'
				and ${appointment.status} != 'rescheduled'
		)`,
		hasUpcoming: sql<boolean>`exists (
			select 1 from ${appointment}
			where ${appointment.clientId} = ${client.id}
				and ${appointment.startAt} > now()
				and ${appointment.status} = 'confirmed'
		)`
	})
	.from(client)
	.innerJoin(therapist, eq(client.therapistId, therapist.id))
	.innerJoin(user, eq(therapist.userId, user.id))
	.innerJoin(therapistSettings, eq(therapistSettings.therapistId, therapist.id))
	.where(
		and(
			eq(client.status, 'active'),
			eq(therapistSettings.sendRebookReminderEmails, true)
		)
	);
```

`hasUpcoming` is the piece that answers "last session was 4 days ago, but do they already
have their next one booked?" — skip the row entirely if true, no matter how overdue the
last session looks.

## 2. Ladder decision (per row, sequential loop like the other jobs)

Verbose if/else, no ternaries (matches the project's code style):

```ts
if (!row.clientEmail || !row.lastSessionAt || row.hasUpcoming) {
	continue;
}

const daysSinceSession = (now.getTime() - row.lastSessionAt.getTime()) / DAY_MS;

// Ladder auto-resets: if they've had a session since the last reminder we sent,
// treat them as fresh (stage 0) without needing a separate reset write — this
// recomputes correctly every tick straight from the two stored columns.
let effectiveStage = row.stage;
if (row.stage > 0 && row.lastReminderAt && row.lastSessionAt > row.lastReminderAt) {
	effectiveStage = 0;
}

let targetStage = 0;
if (daysSinceSession >= 30) {
	targetStage = 3;
} else if (daysSinceSession >= 14) {
	targetStage = 2;
} else if (daysSinceSession >= 4) {
	targetStage = 1;
}

if (targetStage === 0) {
	continue;
}

let shouldSend = false;
if (targetStage > effectiveStage) {
	shouldSend = true;
} else if (targetStage === 3 && effectiveStage === 3) {
	const sinceLastReminder = row.lastReminderAt ? now.getTime() - row.lastReminderAt.getTime() : Infinity;
	if (sinceLastReminder >= 30 * DAY_MS) {
		shouldSend = true;
	}
}

if (!shouldSend) {
	continue;
}
```

Then send and persist:

```ts
await sendEmail(/* stage-specific copy, see below */);
await db
	.update(client)
	.set({ rebookReminderStage: targetStage, lastRebookReminderAt: now })
	.where(eq(client.id, row.clientId));
```

Wrap the send+update in the same try/catch-and-log-per-row pattern as `sendPaymentReminders`
so one bad row can't stop the batch.

## 3. Email copy

Three stage variants, all via `wrapEmail`/`sendEmail`/`escapeHtml` (no new email
infra), CTA linking to `${env.ORIGIN}/portal`, `replyTo: row.therapistEmail` — same as
every other client-facing reminder in `reminderEmails.ts`:

- **Stage 1 (4 days):** light touch — "It's been a few days since your last session with
  {therapist} — want to grab your next one?"
- **Stage 2 (2 weeks):** a bit more direct — "It's been 2 weeks since your last session
  with {therapist}."
- **Stage 3+ (1 month, repeating):** "It's been a month since your last session with
  {therapist}." Same copy reused for every monthly repeat after this.

## 4. Wire into the cron

One line in `src/routes/api/cron/reminders/+server.ts`:

```ts
const JOBS: Record<string, () => Promise<unknown>> = {
	sessionReminders: sendSessionReminders,
	paymentReminders: sendPaymentReminders,
	rebookReminders: sendRebookReminders, // new
	refreshConnections: refreshExpiringConnections,
	sweepStaleOrders: sweepStaleOrders
};
```

No `vercel.json` change needed — it already hits this route daily.

## 5. Settings toggle

`src/lib/server/settings.ts`: add `sendRebookReminderEmails` to the `NotificationSettings`
type and to both the select in `getNotificationSettings` and the `input` shape
`updateNotificationSettings` takes (it already does `.set(input)` with the whole object, so
no other change needed there).

`src/routes/(app)/settings/+page.server.ts`: add
`sendRebookReminderEmails: form.get('sendRebookReminderEmails') === 'on'` to the
`notifications` object in the `update` action.

`src/routes/(app)/settings/+page.svelte`: add a `$state` var seeded from
`initial.notifications.sendRebookReminderEmails`, a matching hidden input, and a `<Switch>`
row next to the existing session/payment reminder switches — e.g. "Email clients who
haven't booked a follow-up session".

## 6. Clients list — "Last session" visibility

So you can see who's due without waiting for the cron tick.

`src/lib/server/appointments.ts`: new `getLastSessionAtByClient(therapistId)` returning a
`Map<clientId, Date>`, grouped-by version of the same past-appointment filter
`listPastAppointmentsForClient` already uses:

```ts
export async function getLastSessionAtByClient(therapistId: string): Promise<Map<string, Date>> {
	const rows = await db
		.select({ clientId: appointment.clientId, lastSessionAt: sql<Date>`max(${appointment.startAt})` })
		.from(appointment)
		.where(
			and(
				eq(appointment.therapistId, therapistId),
				lte(appointment.startAt, new Date()),
				ne(appointment.status, 'cancelled'),
				ne(appointment.status, 'rescheduled')
			)
		)
		.groupBy(appointment.clientId);

	const map = new Map<string, Date>();
	for (const row of rows) {
		if (row.clientId) {
			map.set(row.clientId, row.lastSessionAt);
		}
	}
	return map;
}
```

`src/routes/(app)/clients/+page.server.ts` `load`: call it alongside `listClients`, merge
`lastSessionAt` onto each client row.

`src/routes/(app)/clients/+page.svelte`: render "Last session: N days ago" (or "No sessions
yet") under the existing `.email`/`.rate` lines in the `.info` block, with a small
`daysAgo(date)` formatter.

## Open questions for when this gets built

- Should `paused` clients (not just `left`) also be excluded, the way `active`-only is
  scoped above? Current plan: only `status = 'active'` gets nagged.
- Does "no future session booked" need to also count sessions with other therapists (n/a —
  clients belong to one therapist in this schema) or packs with unused sessions (packs
  aren't appointments, so a client sitting on a paid pack with nothing scheduled still gets
  nudged — arguably correct, they *should* book).