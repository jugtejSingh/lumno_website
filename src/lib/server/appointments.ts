import { and, eq, gte, lt, lte, ne, asc, desc } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { appointment, therapist, client, user } from '$lib/server/db/schema';
import { zonedDayBounds, getZonedDateParts, zonedDateToUTC } from '$lib/server/timezone';
import { getPaymentSettings } from '$lib/server/paymentSettings';
import { resolvePolicyOutcome, tierFraction, feeNote, type PolicyOutcome, type ChangeTier } from '$lib/server/paymentPolicy';
import { addCharge, moveFinancialLinksOnReschedule } from '$lib/server/payments';
import { createMeetEvent, patchMeetEventTime, deleteMeetEvent } from '$lib/server/googleCalendar';
import { getNotificationSettings, getTherapistScheduleSettings } from '$lib/server/settings';
import { sendAppointmentEmail } from '$lib/server/bookingEmails';

// Best-effort: creates a Google Meet event for an online appointment that doesn't have one
// yet, and patches the row with the link/event id. No-op (returns the row unchanged) for
// in-person appointments, an appointment that already has a link, or when the therapist
// hasn't connected Google — booking must never fail on this. Takes an executor like the rest
// of this file so callers can sequence it after other statements on the same tx/db handle.
export async function attachMeetingLinkIfOnline(
	appt: typeof appointment.$inferSelect,
	executor: DbOrTx = db
): Promise<typeof appointment.$inferSelect> {
	if (appt.modality !== 'online' || appt.googleEventId) return appt;

	const notificationSettings = await getNotificationSettings(appt.therapistId);
	if (!notificationSettings.sendMeetLinks) return appt;

	const [therapistRow] = await executor
		.select({ userId: therapist.userId, therapistName: user.name })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(therapist.id, appt.therapistId));
	const [clientRow] = await executor.select({ email: client.email, name: client.name }).from(client).where(eq(client.id, appt.clientId));
	if (!therapistRow) return appt;

	const meetEvent = await createMeetEvent(therapistRow.userId, {
		summary: `Therapy session: ${therapistRow.therapistName} & ${clientRow?.name ?? 'client'}`,
		startAt: appt.startAt,
		endAt: appt.endAt,
		attendeeEmail: clientRow?.email
	});
	if (!meetEvent) return appt;

	const [updated] = await executor
		.update(appointment)
		.set({ meetLink: meetEvent.meetLink, googleEventId: meetEvent.eventId })
		.where(eq(appointment.id, appt.id))
		.returning();
	return updated ?? appt;
}

// Best-effort cleanup for the calendar event backing a cancelled appointment.
export async function detachMeetingLink(appt: typeof appointment.$inferSelect, executor: DbOrTx = db) {
	if (!appt.googleEventId) return;
	const [therapistRow] = await executor.select({ userId: therapist.userId }).from(therapist).where(eq(therapist.id, appt.therapistId));
	if (!therapistRow) return;
	await deleteMeetEvent(therapistRow.userId, appt.googleEventId);
}

// A reschedule never mutates the old appointment row — this moves whatever Meet link was
// attached to it onto the new row. Pure column copy, no network I/O, same convention
// moveFinancialLinksOnReschedule uses for pack/payment rows — safe to run inside the same
// transaction as the rest of the reschedule. The Google event itself gets its time patched
// separately, after that transaction commits (see syncMeetEventOnReschedule).
export async function moveMeetLinkOnReschedule(oldAppointmentId: string, newAppointmentId: string, executor: DbOrTx = db) {
	const [oldAppt] = await executor
		.select({ meetLink: appointment.meetLink, googleEventId: appointment.googleEventId })
		.from(appointment)
		.where(eq(appointment.id, oldAppointmentId));
	if (!oldAppt?.googleEventId) return;

	await executor
		.update(appointment)
		.set({ meetLink: oldAppt.meetLink, googleEventId: oldAppt.googleEventId })
		.where(eq(appointment.id, newAppointmentId));
	await executor.update(appointment).set({ meetLink: null, googleEventId: null }).where(eq(appointment.id, oldAppointmentId));
}

// Reschedule keeps the same Meet link (googleEventId/meetLink are carried over onto newAppt
// by the reschedule transaction, same column-copy pattern moveFinancialLinksOnReschedule uses
// for pack/payment rows) — this just moves the underlying Google event's time. Falls back to
// creating a fresh link when the old appointment never had one (e.g. therapist just connected
// Google), and drops the event entirely when modality changed away from online.
export async function syncMeetEventOnReschedule(newAppt: typeof appointment.$inferSelect, executor: DbOrTx = db): Promise<void> {
	if (newAppt.modality !== 'online') {
		if (newAppt.googleEventId) {
			await detachMeetingLink(newAppt, executor);
			await executor.update(appointment).set({ meetLink: null, googleEventId: null }).where(eq(appointment.id, newAppt.id));
		}
		return;
	}

	if (!newAppt.googleEventId) {
		await attachMeetingLinkIfOnline(newAppt, executor);
		return;
	}

	const [therapistRow] = await executor.select({ userId: therapist.userId }).from(therapist).where(eq(therapist.id, newAppt.therapistId));
	if (!therapistRow) return;
	await patchMeetEventTime(therapistRow.userId, newAppt.googleEventId, { startAt: newAppt.startAt, endAt: newAppt.endAt });
}

// Lazily flips past confirmed appointments to 'completed'. Called from the calendar reads
// (therapist calendar + client portal) — those are the only pages that surface old rows, so
// no cron is needed. Keeps hasBufferOverlap and the appointment_no_overlap trigger's scan
// bounded to live bookings instead of the therapist's whole history.
// This UPDATE does NOT fire appointment_no_overlap: that trigger only runs
// WHEN (NEW.status = 'confirmed'), and this sets status away from 'confirmed'.
export async function markPastAppointmentsCompleted(therapistId: string) {
	await db
		.update(appointment)
		.set({ status: 'completed' })
		.where(
			and(
				eq(appointment.therapistId, therapistId),
				eq(appointment.status, 'confirmed'),
				lt(appointment.endAt, new Date())
			)
		);
}

export async function listUpcomingAppointmentsForClient(clientId: string, therapistTimezone: string) {
	const rows = await db
		.select({
			id: appointment.id,
			startAt: appointment.startAt,
			modality: appointment.modality,
			status: appointment.status,
			meetLink: appointment.meetLink
		})
		.from(appointment)
		.where(
			and(
				eq(appointment.clientId, clientId),
				gte(appointment.startAt, new Date()),
				ne(appointment.status, 'cancelled'),
				ne(appointment.status, 'rescheduled')
			)
		)
		.orderBy(asc(appointment.startAt));

	return rows.map((row) => ({
		...row,
		when: new Intl.DateTimeFormat('en-US', {
			timeZone: therapistTimezone,
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(row.startAt)
	}));
}

export async function listPastAppointmentsForClient(therapistId: string, clientId: string, therapistTimezone: string) {
	const rows = await db
		.select({ id: appointment.id, startAt: appointment.startAt })
		.from(appointment)
		.where(
			and(
				eq(appointment.therapistId, therapistId),
				eq(appointment.clientId, clientId),
				lte(appointment.startAt, new Date()),
				ne(appointment.status, 'cancelled'),
				ne(appointment.status, 'rescheduled')
			)
		)
		.orderBy(desc(appointment.startAt));

	return rows.map((row) => ({
		id: row.id,
		when: new Intl.DateTimeFormat('en-US', {
			timeZone: therapistTimezone,
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(row.startAt)
	}));
}

export async function listAppointmentsForMonth(therapistId: string, year: number, month: number) {
	const [therapistRow] = await db
		.select({ timezone: therapist.timezone })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	const timezone = therapistRow?.timezone ?? 'Asia/Kolkata';

	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const { start } = zonedDayBounds(year, month, 1, timezone);
	const { end } = zonedDayBounds(year, month, daysInMonth, timezone);

	const rows = await db
		.select({
			id: appointment.id,
			startAt: appointment.startAt,
			endAt: appointment.endAt,
			modality: appointment.modality,
			status: appointment.status,
			notes: appointment.notes,
			meetLink: appointment.meetLink,
			clientName: client.name
		})
		.from(appointment)
		.innerJoin(client, eq(appointment.clientId, client.id))
		.where(
			and(
				eq(appointment.therapistId, therapistId),
				gte(appointment.startAt, start),
				lt(appointment.startAt, end)
			)
		);
	// all four statuses are returned — the calendar renders cancelled/rescheduled greyed and inert

	// attach the local calendar day (in the therapist's own timezone) each appointment falls on,
	// so the UI can group them into day cells without re-deriving timezone math itself
	return rows.map((row) => ({ ...row, ...getZonedDateParts(row.startAt, timezone) }));
}

export type NewAppointmentInput = {
	clientId: string;
	year: number;
	month: number; // 0-indexed
	day: number;
	startHour: number;
	startMinute: number;
	endHour: number;
	endMinute: number;
	modality: 'online' | 'in_person';
	notes?: string | null;
	rescheduledFromId?: string | null;
};

export type CreateAppointmentResult = {
	appointment?: typeof appointment.$inferSelect;
	error?: 'invalid_range' | 'overlap' | 'invalid_client';
};

// Mirrors the appointment_no_overlap trigger's buffer-padded interval test, in JS, so a
// clean { error: 'overlap' } can be returned before the insert (a trigger error is
// unrecoverable once inside a transaction — see createAppointmentForTherapist). Matches the
// trigger exactly, including that a reschedule still collides with its own original slot
// (the old row is 'confirmed' until finishReschedule flips it, after this insert).
async function hasBufferOverlap(
	therapistId: string,
	startAt: Date,
	endAt: Date,
	executor: DbOrTx = db
): Promise<boolean> {
	const { bufferMinutes } = await getTherapistScheduleSettings(therapistId);
	const bufferMs = bufferMinutes * 60_000;
	const confirmed = await executor
		.select({ startAt: appointment.startAt, endAt: appointment.endAt })
		.from(appointment)
		.where(and(eq(appointment.therapistId, therapistId), eq(appointment.status, 'confirmed')));
	for (const existing of confirmed) {
		if (
			existing.startAt.getTime() < endAt.getTime() + bufferMs &&
			startAt.getTime() < existing.endAt.getTime() + bufferMs
		) {
			return true;
		}
	}
	return false;
}

// The therapist booking their own calendar overrides working hours, holidays, and
// weekly schedule — none of that is enforced here, only elsewhere for client self-booking.
// The DB's appointment_no_overlap trigger still applies: it's a real double-booking, not a policy.
export async function createAppointmentForTherapist(
	therapistId: string,
	input: NewAppointmentInput,
	executor: DbOrTx = db
): Promise<CreateAppointmentResult> {
	const [therapistRow] = await executor
		.select({ timezone: therapist.timezone })
		.from(therapist)
		.where(eq(therapist.id, therapistId));
	const timezone = therapistRow?.timezone ?? 'Asia/Kolkata';

	// clientId comes straight from the caller's form input, not the session — never trust it
	// belongs to this therapist without checking, or one therapist could book/charge against
	// another therapist's client just by knowing their id.
	const [clientRow] = await executor.select({ therapistId: client.therapistId }).from(client).where(eq(client.id, input.clientId));
	if (clientRow?.therapistId !== therapistId) {
		return { error: 'invalid_client' as const };
	}

	const startAt = zonedDateToUTC(input.year, input.month, input.day, input.startHour, input.startMinute, timezone);
	const endAt = zonedDateToUTC(input.year, input.month, input.day, input.endHour, input.endMinute, timezone);

	if (endAt <= startAt) {
		return { error: 'invalid_range' as const };
	}

	// The appointment_no_overlap trigger is the source of truth (and the race backstop in the
	// catch below), but inside finishReschedule's transaction postgres-js surfaces a trigger
	// error as an aborted-transaction throw the catch can't convert — so the clean
	// { error: 'overlap' } has to come from a pre-check here.
	if (await hasBufferOverlap(therapistId, startAt, endAt, executor)) {
		return { error: 'overlap' as const };
	}

	try {
		const [row] = await executor
			.insert(appointment)
			.values({
				therapistId,
				clientId: input.clientId,
				startAt,
				endAt,
				modality: input.modality,
				notes: input.notes || null,
				rescheduledFromId: input.rescheduledFromId ?? null
			})
			.returning();
		return { appointment: row };
	} catch (err) {
		if (err instanceof Error && err.message.includes('appointment_overlaps_existing_booking')) {
			return { error: 'overlap' as const };
		}
		throw err;
	}
}

// Both cancel and reschedule below share this: the cancellation-policy tier only ever
// depends on the ORIGINAL appointment's start time and the therapist's settings — nothing
// else about the request changes what's owed.
async function resolveOutcomeFor(therapistId: string, appt: typeof appointment.$inferSelect): Promise<PolicyOutcome> {
	const [clientRow] = await db.select({ rate: client.rate }).from(client).where(eq(client.id, appt.clientId));
	const settings = await getPaymentSettings(therapistId);
	return resolvePolicyOutcome(appt.startAt, settings, clientRow?.rate ?? 0);
}

export type CancelAppointmentResult = { outcome: PolicyOutcome } | { error: 'not_found' | 'charge_required' };

// clientId is optional so the therapist's calendar can cancel any of their own
// appointments, but when a client cancels their own session it must be passed —
// otherwise nothing stops one client from cancelling another client's appointment
// just by knowing its id (both belong to the same therapist).
//
// manualTier only applies to cancelling an already-completed session: the time-based
// policy tiers make no sense once the session has happened, so the therapist picks the
// fee explicitly (0% / 50% / 100%). Ignored for a still-upcoming session.
export async function cancelAppointment(
	therapistId: string,
	appointmentId: string,
	clientId?: string,
	manualTier?: ChangeTier
): Promise<CancelAppointmentResult> {
	const [appt] = await db
		.select()
		.from(appointment)
		.where(
			and(
				eq(appointment.id, appointmentId),
				eq(appointment.therapistId, therapistId),
				...(clientId ? [eq(appointment.clientId, clientId)] : [])
			)
		);
	if (!appt || appt.status === 'cancelled' || appt.status === 'rescheduled') {
		return { error: 'not_found' as const };
	}

	let outcome: PolicyOutcome;
	if (appt.status === 'completed') {
		// A finished session can only be cancelled by the therapist — the client self-service
		// path always passes clientId, so treat that as not-found rather than leak that the
		// session exists. And the therapist must pick a fee explicitly.
		if (clientId) {
			return { error: 'not_found' as const };
		}
		if (!manualTier) {
			return { error: 'charge_required' as const };
		}
		const [clientRow] = await db.select({ rate: client.rate }).from(client).where(eq(client.id, appt.clientId));
		const baseAmount = clientRow?.rate ?? 0;
		outcome = { tier: manualTier, feeAmount: Math.round(baseAmount * tierFraction(manualTier)) };
	} else {
		outcome = await resolveOutcomeFor(therapistId, appt);
	}

	await db.transaction(async (tx) => {
		await tx.update(appointment).set({ status: 'cancelled' }).where(eq(appointment.id, appointmentId));

		if (outcome.tier === 'free') {
			// free-tier cancellation returns the pack credit — clearing pack_id is what
			// "returning a credit" means, per the credits-remaining derivation
			if (appt.packId) {
				await tx.update(appointment).set({ packId: null }).where(eq(appointment.id, appointmentId));
			}
		} else {
			await addCharge(
				therapistId,
				{
					clientId: appt.clientId,
					appointmentId,
					amount: outcome.feeAmount,
					note: feeNote('cancellation', outcome.tier)
				},
				tx
			);
		}
	});

	await detachMeetingLink(appt);
	await sendAppointmentEmail(appt.id, 'cancelled', {
		feeAmount: outcome.tier !== 'free' ? outcome.feeAmount : 0
	});

	return { outcome };
}

export type RescheduleAppointmentResult =
	| { appointment: typeof appointment.$inferSelect; outcome: PolicyOutcome }
	| { error: 'not_found' | 'invalid_range' | 'overlap' | 'unavailable' | 'invalid_client' };

export type RescheduleInsertResult =
	| { appointment: typeof appointment.$inferSelect }
	| { error: 'invalid_range' | 'overlap' | 'unavailable' | 'invalid_client' };

// Shared tail for BOTH reschedule flows (therapist-driven here, client self-service in
// availability.ts) — this was previously duplicated near line-for-line in each. Only the new
// row's insert differs (therapist: arbitrary time range, no availability check; client: a
// fixed slot re-checked against open availability), so that part stays a caller-supplied
// callback. Everything after it — flipping the old row to 'rescheduled', moving financial and
// Meet-link attachments onto the new row, charging the reschedule fee — is identical business
// logic either way and now lives in exactly one place.
export async function finishReschedule(
	therapistId: string,
	oldAppt: typeof appointment.$inferSelect,
	insertNew: (tx: DbOrTx) => Promise<RescheduleInsertResult>
): Promise<RescheduleAppointmentResult> {
	const outcome = await resolveOutcomeFor(therapistId, oldAppt);

	const result = await db.transaction(async (tx) => {
		const inserted = await insertNew(tx);
		if ('error' in inserted) {
			return inserted;
		}

		await tx.update(appointment).set({ status: 'rescheduled' }).where(eq(appointment.id, oldAppt.id));
		await moveFinancialLinksOnReschedule(oldAppt.id, inserted.appointment.id, tx);
		await moveMeetLinkOnReschedule(oldAppt.id, inserted.appointment.id, tx);

		if (outcome.tier !== 'free') {
			await addCharge(
				therapistId,
				{
					clientId: oldAppt.clientId,
					appointmentId: inserted.appointment.id,
					amount: outcome.feeAmount,
					note: feeNote('reschedule', outcome.tier)
				},
				tx
			);
		}

		return inserted;
	});
	if ('error' in result) {
		return result;
	}

	// re-fetch: moveMeetLinkOnReschedule wrote meetLink/googleEventId onto this row after
	// `result.appointment` was captured inside the transaction above
	const [freshAppointment] = await db.select().from(appointment).where(eq(appointment.id, result.appointment.id));
	await syncMeetEventOnReschedule(freshAppointment ?? result.appointment);
	await sendAppointmentEmail(result.appointment.id, 'rescheduled', {
		previousStartAt: oldAppt.startAt,
		feeAmount: outcome.tier !== 'free' ? outcome.feeAmount : 0
	});

	return { appointment: freshAppointment ?? result.appointment, outcome };
}

// Therapist rescheduling their own calendar — no availability-window constraints,
// same as createAppointmentForTherapist. See rescheduleAppointmentForClient in
// availability.ts for the client self-service version (which re-checks open slots).
export async function rescheduleAppointmentForTherapist(
	therapistId: string,
	oldAppointmentId: string,
	input: Omit<NewAppointmentInput, 'clientId'>
): Promise<RescheduleAppointmentResult> {
	const [oldAppt] = await db
		.select()
		.from(appointment)
		.where(and(eq(appointment.id, oldAppointmentId), eq(appointment.therapistId, therapistId)));
	if (
		!oldAppt ||
		oldAppt.status === 'cancelled' ||
		oldAppt.status === 'rescheduled' ||
		oldAppt.status === 'completed'
	) {
		return { error: 'not_found' as const };
	}

	return finishReschedule(therapistId, oldAppt, async (tx) => {
		const created = await createAppointmentForTherapist(
			therapistId,
			{ ...input, clientId: oldAppt.clientId, rescheduledFromId: oldAppt.id },
			tx
		);
		if (created.error || !created.appointment) {
			return { error: created.error ?? ('invalid_range' as const) };
		}
		return { appointment: created.appointment };
	});
}