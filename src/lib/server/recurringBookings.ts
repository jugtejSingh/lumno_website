import { and, eq, gt, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import {
	appointment,
	availabilitySlot,
	client,
	payment,
	therapist,
	therapistSettings
} from '$lib/server/db/schema';
import { getZonedDateParts, parseTimeOfDay, zonedDateToUTC } from '$lib/server/timezone';
import { bookingWindowEnd } from '$lib/server/bookingWindow';
import { isTooSoonAfterLastHold } from '$lib/bookingSchedule';
import { listDesignedDaysForMonth, type DesignedDay, type DesignedSlot } from '$lib/server/availabilitySlots';
import { addCharge, completePackIfExhausted, getActivePackForClient, returnPackCredit } from '$lib/server/payments';
import { attachMeetingLinkIfOnline, bumpLastSessionAt, isOverlapError } from '$lib/server/appointments';
import { logError } from '$lib/server/log';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
// the longest gap between two sessions of one reserved slot (every 4 weeks)
const MAX_EVERY_WEEKS = 4;

type Candidate = {
	slotId: string;
	everyWeeks: number;
	therapistId: string;
	clientId: string;
	clientRate: number | null;
	startAt: Date;
	endAt: Date;
	modality: 'online' | 'in_person';
};

export type MaterialiseResult = {
	created: number;
	// weeks skipped because another booking already sits at that time
	blocked: number;
	failed: number;
};

function findDesignedSlot(day: DesignedDay | undefined, startTime: string, endTime: string): DesignedSlot | null {
	if (!day) {
		return null;
	}
	for (const designed of day.slots) {
		if (designed.startTime === startTime && designed.endTime === endTime) {
			return designed;
		}
	}
	return null;
}

/**
 * Books every weekly slot that is reserved for a client (or just `slotId`) as far ahead as the
 * therapist's booking window, plus one day, so a reserved session is already in the calendar
 * (and counted against the daily cap) before its day opens to other clients. A slot repeating
 * every 2 or 4 weeks skips dates that fall too soon after its last session (see
 * isTooSoonAfterLastHold), so its first session is the next matching weekday and the rest follow.
 * Safe to run any number of times: a week is only ever created once, and a week the therapist
 * or client cancelled or rescheduled keeps its old row, so it is never booked again.
 *
 * A week is skipped when the date no longer offers the slot (holiday, day off, or a hand-edited
 * date without it), when the client is deactivated, or when it would overlap another booking (counted as `blocked`). The daily session cap is deliberately not
 * applied: the therapist reserved the slot on purpose. No confirmation email goes out (the usual
 * 24h/1h reminders still do), and nothing is ever cancelled here.
 *
 * ponytail: loads each therapist's month design once per run and books one appointment at a
 * time; batch or chunk by therapist if a run ever nears the cron's time limit.
 */
export async function materialiseReservedSlots(options: { slotId?: string } = {}): Promise<MaterialiseResult> {
	const now = new Date();

	const conditions = [
		isNotNull(availabilitySlot.reservedClientId),
		isNotNull(availabilitySlot.weekday),
		isNull(client.deactivatedAt)
	];
	if (options.slotId !== undefined) {
		conditions.push(eq(availabilitySlot.id, options.slotId));
	}

	// the partial index on reserved_client_id means this never reads the open slots
	const reserved = await db
		.select({
			slotId: availabilitySlot.id,
			therapistId: availabilitySlot.therapistId,
			clientId: client.id,
			clientRate: client.rate,
			weekday: availabilitySlot.weekday,
			startTime: availabilitySlot.startTime,
			endTime: availabilitySlot.endTime,
			everyWeeks: availabilitySlot.reservedEveryWeeks,
			timezone: therapist.timezone,
			windowDays: therapistSettings.bookingWindowDays
		})
		.from(availabilitySlot)
		.innerJoin(client, eq(client.id, availabilitySlot.reservedClientId))
		.innerJoin(therapist, eq(therapist.id, availabilitySlot.therapistId))
		.innerJoin(therapistSettings, eq(therapistSettings.therapistId, availabilitySlot.therapistId))
		.where(and(...conditions));

	const designCache = new Map<string, Record<number, DesignedDay>>();
	async function designFor(therapistId: string, year: number, month: number) {
		const key = `${therapistId}|${year}|${month}`;
		const cached = designCache.get(key);
		if (cached) {
			return cached;
		}
		const design = await listDesignedDaysForMonth(therapistId, year, month);
		designCache.set(key, design);
		return design;
	}

	const candidates: Candidate[] = [];
	let latestWindowEnd = now;
	for (const slot of reserved) {
		const today = getZonedDateParts(now, slot.timezone);
		// one day beyond what clients can see, so the session exists before its day opens
		const windowEnd = bookingWindowEnd(now, slot.timezone, slot.windowDays + 1);
		if (windowEnd > latestWindowEnd) {
			latestWindowEnd = windowEnd;
		}
		const [hour, minute] = parseTimeOfDay(slot.startTime);
		const [endHour, endMinute] = parseTimeOfDay(slot.endTime);
		const startLabel = slot.startTime.slice(0, 5);
		const endLabel = slot.endTime.slice(0, 5);

		// a calendar date's weekday doesn't depend on timezone, so plain UTC date maths is safe here
		for (let offset = 0; offset <= slot.windowDays + 2; offset++) {
			const date = new Date(Date.UTC(today.year, today.month, today.day + offset));
			if (date.getUTCDay() !== slot.weekday) {
				continue;
			}
			const year = date.getUTCFullYear();
			const month = date.getUTCMonth();
			const day = date.getUTCDate();

			const startAt = zonedDateToUTC(year, month, day, hour, minute, slot.timezone);
			const endAt = zonedDateToUTC(year, month, day, endHour, endMinute, slot.timezone);
			if (startAt <= now || startAt >= windowEnd) {
				continue;
			}

			// holiday, day off and edited dates all show up here as "the slot isn't offered"
			const design = await designFor(slot.therapistId, year, month);
			const designed = findDesignedSlot(design[day], startLabel, endLabel);
			if (!designed || designed.modality === 'hybrid') {
				continue;
			}

			candidates.push({
				slotId: slot.slotId,
				everyWeeks: slot.everyWeeks,
				therapistId: slot.therapistId,
				clientId: slot.clientId,
				clientRate: slot.clientRate,
				startAt,
				endAt,
				modality: designed.modality
			});
		}
	}
	if (candidates.length === 0) {
		return { created: 0, blocked: 0, failed: 0 };
	}

	// oldest first, so a pack's remaining credits go to the earliest weeks
	candidates.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

	// any status counts: a cancelled or rescheduled week must not be booked again
	const clientIds: string[] = [];
	for (const candidate of candidates) {
		if (!clientIds.includes(candidate.clientId)) {
			clientIds.push(candidate.clientId);
		}
	}
	const existing = await db
		.select({ clientId: appointment.clientId, startAt: appointment.startAt })
		.from(appointment)
		.where(
			and(
				inArray(appointment.clientId, clientIds),
				gte(appointment.startAt, now),
				lt(appointment.startAt, latestWindowEnd)
			)
		);
	const taken = new Set<string>();
	for (const row of existing) {
		taken.add(`${row.clientId}|${row.startAt.getTime()}`);
	}

	// every earlier session of each every-2/4-weeks slot, so its next date can be worked out
	const everyNWeeksSlotIds: string[] = [];
	for (const candidate of candidates) {
		if (candidate.everyWeeks > 1 && !everyNWeeksSlotIds.includes(candidate.slotId)) {
			everyNWeeksSlotIds.push(candidate.slotId);
		}
	}
	const holdsBySlot = new Map<string, Date[]>();
	if (everyNWeeksSlotIds.length > 0) {
		const lookbackStart = new Date(now.getTime() - MAX_EVERY_WEEKS * WEEK_DAYS * DAY_MS);
		const earlier = await db
			.select({ slotId: appointment.slotId, startAt: appointment.startAt })
			.from(appointment)
			.where(
				and(
					inArray(appointment.slotId, everyNWeeksSlotIds),
					gte(appointment.startAt, lookbackStart),
					lt(appointment.startAt, latestWindowEnd)
				)
			);
		for (const row of earlier) {
			const holds = holdsBySlot.get(row.slotId!) ?? [];
			holds.push(row.startAt);
			holdsBySlot.set(row.slotId!, holds);
		}
	}

	let created = 0;
	let blocked = 0;
	let failed = 0;
	for (const candidate of candidates) {
		const key = `${candidate.clientId}|${candidate.startAt.getTime()}`;
		if (taken.has(key)) {
			continue;
		}
		const slotHolds = holdsBySlot.get(candidate.slotId) ?? [];
		if (isTooSoonAfterLastHold(candidate.startAt, slotHolds, candidate.everyWeeks)) {
			continue;
		}
		try {
			const booked = await bookCandidate(candidate);
			if (booked) {
				created++;
				taken.add(key);
				slotHolds.push(candidate.startAt);
				holdsBySlot.set(candidate.slotId, slotHolds);
			} else {
				blocked++;
			}
		} catch (err) {
			// one bad week must not stop everyone else's
			failed++;
			logError('recurringBookings.book', err);
		}
	}
	return { created, blocked, failed };
}

// Mirrors createAppointmentForClient's pack/charge handling, minus the self-booking rules
// (upcoming limit, zero balance, daily cap) and the confirmation email. Returns null when the
// week overlaps another booking.
async function bookCandidate(candidate: Candidate) {
	// an exhausted (or absent) pack simply falls through to a regular-price charge below
	const activePack = await getActivePackForClient(candidate.clientId);
	const packHasCredit = !!activePack && activePack.remaining > 0;
	let packId: string | null = null;
	if (packHasCredit) {
		packId = activePack!.id;
	}

	const row = await db.transaction(async (tx) => {
		let inserted;
		try {
			// savepoint: a failed insert would otherwise poison the enclosing transaction
			const rows = await tx.transaction(async (savepoint) => {
				const insertedRows = await savepoint
					.insert(appointment)
					.values({
						therapistId: candidate.therapistId,
						clientId: candidate.clientId,
						startAt: candidate.startAt,
						endAt: candidate.endAt,
						modality: candidate.modality,
						packId,
						slotId: candidate.slotId
					})
					.returning();
				await bumpLastSessionAt(savepoint, candidate.clientId, candidate.startAt);
				return insertedRows;
			});
			inserted = rows[0];
		} catch (err) {
			if (isOverlapError(err)) {
				return null;
			}
			throw err;
		}

		if (packHasCredit) {
			await completePackIfExhausted(activePack!.id, tx);
		} else {
			await addCharge(
				candidate.therapistId,
				{ clientId: candidate.clientId, appointmentId: inserted.id, amount: candidate.clientRate ?? 0 },
				tx
			);
		}
		return inserted;
	});
	if (!row) {
		return null;
	}

	try {
		return await attachMeetingLinkIfOnline(row);
	} catch (err) {
		// the session is booked either way; a missing Meet link is fixable, a missing session is not
		logError('recurringBookings.meetLink', err);
		return row;
	}
}

// Deletes a reserved slot's upcoming holds, inside the caller's transaction. Runs whenever the
// slot's time, client or reservation changes. Unpaid charges that never reached checkout go with
// them; anything else (paid, or mid-checkout) is kept and just unlinked by the payment FK. Pack
// sessions go back to the pack. Returns the deleted rows so the caller can detach Meet links
// once the transaction has committed.
export async function deleteFutureHolds(tx: DbOrTx, slotId: string) {
	const holdFilter = and(
		eq(appointment.slotId, slotId),
		eq(appointment.status, 'confirmed'),
		gt(appointment.startAt, new Date())
	);
	const holds = await tx.select({ id: appointment.id }).from(appointment).where(holdFilter);
	if (holds.length === 0) {
		return [];
	}

	const holdIds: string[] = [];
	for (const hold of holds) {
		holdIds.push(hold.id);
	}

	await tx
		.delete(payment)
		.where(
			and(
				inArray(payment.appointmentId, holdIds),
				eq(payment.status, 'unpaid'),
				isNull(payment.razorpayOrderId)
			)
		);
	const deleted = await tx.delete(appointment).where(inArray(appointment.id, holdIds)).returning();

	for (const row of deleted) {
		if (row.packId) {
			await returnPackCredit(row.packId, tx);
		}
	}
	return deleted;
}
