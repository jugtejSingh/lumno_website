import { and, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { payment, paymentPack, appointment, client } from '$lib/server/db/schema';

// Callers that need pack-consumption or reschedule-link updates to be atomic with an
// appointment insert/update pass their `db.transaction` callback's `tx` here instead of
// letting these functions fall back to the module-level `db`.
type Executor = DbOrTx;

// ---- single-session / ad-hoc charges ----------------------------------

// exactly one of clientId/customName — same convention as the payment table itself
export type NewPaymentInput =
	| { clientId: string; customName?: never; appointmentId?: string | null; amount: number; note?: string | null }
	| { clientId?: never; customName: string; appointmentId?: string | null; amount: number; note?: string | null };

export async function addCharge(therapistId: string, input: NewPaymentInput, executor: Executor = db) {
	const [row] = await executor
		.insert(payment)
		.values({
			therapistId,
			clientId: input.clientId ?? null,
			customName: input.customName ?? null,
			appointmentId: input.appointmentId ?? null,
			amount: input.amount,
			note: input.note ?? null
		})
		.returning();
	return row;
}

export async function updatePayment(
	therapistId: string,
	paymentId: string,
	input: { amount?: number; note?: string | null }
) {
	await db
		.update(payment)
		.set(input)
		.where(and(eq(payment.id, paymentId), eq(payment.therapistId, therapistId)));
}

export async function setPaymentStatus(therapistId: string, paymentId: string, status: 'paid' | 'unpaid') {
	await db
		.update(payment)
		.set({ status, paidAt: status === 'paid' ? new Date() : null })
		.where(and(eq(payment.id, paymentId), eq(payment.therapistId, therapistId)));
}

export async function deletePayment(therapistId: string, paymentId: string) {
	await db.delete(payment).where(and(eq(payment.id, paymentId), eq(payment.therapistId, therapistId)));
}

export type ClientPaymentHistoryRow = {
	id: string;
	amount: number;
	note: string | null;
	status: 'unpaid' | 'paid';
	createdAt: Date;
	appointmentStartAt: Date | null;
	appointmentModality: 'online' | 'in_person' | null;
};

// The full paid + unpaid charge history for one client, newest first — backs the
// per-client history modal (totals + this list, see getClientPaymentTotals below).
export async function listPaymentsForClientPage(
	therapistId: string,
	clientId: string,
	page: number,
	pageSize: number
): Promise<{ rows: ClientPaymentHistoryRow[]; total: number }> {
	const where = and(eq(payment.therapistId, therapistId), eq(payment.clientId, clientId));

	const [rows, [countRow]] = await Promise.all([
		db
			.select({
				id: payment.id,
				amount: payment.amount,
				note: payment.note,
				status: payment.status,
				createdAt: payment.createdAt,
				appointmentStartAt: appointment.startAt,
				appointmentModality: appointment.modality
			})
			.from(payment)
			.leftJoin(appointment, eq(payment.appointmentId, appointment.id))
			.where(where)
			.orderBy(desc(payment.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db.select({ count: sql<number>`count(*)::int` }).from(payment).where(where)
	]);

	return { rows, total: countRow?.count ?? 0 };
}

export type ClientPaymentTotals = { owed: number; paidThisMonth: number; paidThisYear: number };

// Powers the same modal's summary stats. "Owed" mirrors listOutstandingBalancesByClient's
// definition (unpaid payment rows + pending-payment packs) but for a single client instead
// of grouped across the whole roster.
export async function getClientPaymentTotals(therapistId: string, clientId: string): Promise<ClientPaymentTotals> {
	const now = new Date();
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

	const [paymentRow] = await db
		.select({
			unpaid: sql<number>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'unpaid'), 0)::int`,
			paidThisMonth: sql<number>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'paid' and ${payment.createdAt} >= ${monthStart.toISOString()}), 0)::int`,
			paidThisYear: sql<number>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'paid' and ${payment.createdAt} >= ${yearStart.toISOString()}), 0)::int`
		})
		.from(payment)
		.where(and(eq(payment.therapistId, therapistId), eq(payment.clientId, clientId)));

	const [pendingPackRow] = await db
		.select({ owed: sql<number>`coalesce(sum(${paymentPack.amount}), 0)::int` })
		.from(paymentPack)
		.where(
			and(
				eq(paymentPack.therapistId, therapistId),
				eq(paymentPack.clientId, clientId),
				eq(paymentPack.status, 'pending_payment')
			)
		);

	return {
		owed: (paymentRow?.unpaid ?? 0) + (pendingPackRow?.owed ?? 0),
		paidThisMonth: paymentRow?.paidThisMonth ?? 0,
		paidThisYear: paymentRow?.paidThisYear ?? 0
	};
}

// The client-facing version of the above: a paid charge is always visible (it's their
// receipt), but an unpaid one only becomes visible once the session it's for has actually
// happened — ad-hoc charges (no appointment) and cancelled sessions don't wait on anything.
export async function listVisiblePaymentsForClient(clientId: string) {
	return db
		.select({
			id: payment.id,
			amount: payment.amount,
			note: payment.note,
			status: payment.status,
			createdAt: payment.createdAt,
			paidAt: payment.paidAt
		})
		.from(payment)
		.leftJoin(appointment, eq(payment.appointmentId, appointment.id))
		.where(
			and(
				eq(payment.clientId, clientId),
				or(
					eq(payment.status, 'paid'),
					and(
						eq(payment.status, 'unpaid'),
						or(isNull(payment.appointmentId), and(ne(appointment.status, 'cancelled'), lte(appointment.endAt, new Date())))
					)
				)
			)
		)
		.orderBy(desc(payment.createdAt));
}

// ---- packs --------------------------------------------------------------

export type NewPackInput = {
	clientId: string;
	sessionCount: number;
	amount: number;
};

export async function createPack(therapistId: string, input: NewPackInput) {
	const [row] = await db
		.insert(paymentPack)
		.values({ therapistId, clientId: input.clientId, sessionCount: input.sessionCount, amount: input.amount })
		.returning();
	return row;
}

export async function updatePack(
	therapistId: string,
	packId: string,
	input: { sessionCount?: number; amount?: number }
) {
	if (input.sessionCount !== undefined) {
		const remaining = await getPackConsumedCount(packId);
		if (input.sessionCount < remaining) {
			return { error: 'below_consumed' as const };
		}
	}
	await db
		.update(paymentPack)
		.set(input)
		.where(and(eq(paymentPack.id, packId), eq(paymentPack.therapistId, therapistId)));
	return {};
}

// The only way a pack becomes bookable-against — "block until payment clears" for packs
// falls out of this being the sole path to 'active', not a separate flag.
export async function markPackPaid(therapistId: string, packId: string) {
	const [pack] = await db
		.select()
		.from(paymentPack)
		.where(and(eq(paymentPack.id, packId), eq(paymentPack.therapistId, therapistId)));
	if (!pack) return { error: 'not_found' as const };

	const activePack = await getActivePackForClient(pack.clientId);
	if (activePack && activePack.id !== packId) {
		return { error: 'client_has_active_pack' as const, remaining: activePack.remaining };
	}

	await db
		.update(paymentPack)
		.set({ status: 'active', paidAt: new Date() })
		.where(eq(paymentPack.id, packId));
	return {};
}

export async function cancelPack(therapistId: string, packId: string) {
	await db
		.update(paymentPack)
		.set({ status: 'cancelled' })
		.where(and(eq(paymentPack.id, packId), eq(paymentPack.therapistId, therapistId)));
}

async function getPackConsumedCount(packId: string, executor: Executor = db): Promise<number> {
	const [row] = await executor
		.select({ count: sql<number>`count(*)::int` })
		.from(appointment)
		.where(eq(appointment.packId, packId));
	return row?.count ?? 0;
}

export async function getActivePackForClient(clientId: string) {
	const [pack] = await db
		.select()
		.from(paymentPack)
		.where(and(eq(paymentPack.clientId, clientId), eq(paymentPack.status, 'active')));
	if (!pack) return null;

	const consumed = await getPackConsumedCount(pack.id);
	return { ...pack, remaining: pack.sessionCount - consumed };
}

export async function listPacksForClient(therapistId: string, clientId: string) {
	return db
		.select()
		.from(paymentPack)
		.where(and(eq(paymentPack.therapistId, therapistId), eq(paymentPack.clientId, clientId)))
		.orderBy(paymentPack.createdAt);
}

export type PackWithClient = {
	id: string;
	clientId: string;
	clientName: string;
	sessionCount: number;
	amount: number;
	status: 'pending_payment' | 'active' | 'completed' | 'cancelled';
	remaining: number;
	createdAt: Date;
	paidAt: Date | null;
};

// Every pack across every client, for the "session packs" overview — listPacksForClient
// (above) is scoped to one client, this is the therapist's full-roster view.
export async function listPacksForTherapist(therapistId: string): Promise<PackWithClient[]> {
	const packs = await db
		.select({
			id: paymentPack.id,
			clientId: paymentPack.clientId,
			clientName: client.name,
			sessionCount: paymentPack.sessionCount,
			amount: paymentPack.amount,
			status: paymentPack.status,
			createdAt: paymentPack.createdAt,
			paidAt: paymentPack.paidAt
		})
		.from(paymentPack)
		.innerJoin(client, eq(paymentPack.clientId, client.id))
		.where(eq(paymentPack.therapistId, therapistId))
		.orderBy(desc(paymentPack.createdAt));

	if (packs.length === 0) return [];

	const consumedRows = await db
		.select({ packId: appointment.packId, count: sql<number>`count(*)::int` })
		.from(appointment)
		.where(
			inArray(
				appointment.packId,
				packs.map((p) => p.id)
			)
		)
		.groupBy(appointment.packId);
	const consumedByPack = new Map(consumedRows.map((r) => [r.packId, r.count]));

	return packs.map((p) => ({ ...p, remaining: p.sessionCount - (consumedByPack.get(p.id) ?? 0) }));
}

export async function hasOutstandingBalance(therapistId: string, clientId: string): Promise<boolean> {
	const [unpaid] = await db
		.select({ id: payment.id })
		.from(payment)
		.where(and(eq(payment.therapistId, therapistId), eq(payment.clientId, clientId), eq(payment.status, 'unpaid')))
		.limit(1);
	if (unpaid) return true;

	const [pendingPack] = await db
		.select({ id: paymentPack.id })
		.from(paymentPack)
		.where(
			and(
				eq(paymentPack.therapistId, therapistId),
				eq(paymentPack.clientId, clientId),
				eq(paymentPack.status, 'pending_payment')
			)
		)
		.limit(1);
	return !!pendingPack;
}

// Called once a booking has been made against a pack — flips the pack to
// 'completed' if that booking used the last remaining credit.
export async function completePackIfExhausted(packId: string, executor: Executor = db) {
	const [pack] = await executor.select().from(paymentPack).where(eq(paymentPack.id, packId));
	if (!pack) return;
	const consumed = await getPackConsumedCount(packId, executor);
	if (consumed >= pack.sessionCount) {
		await executor.update(paymentPack).set({ status: 'completed' }).where(eq(paymentPack.id, packId));
	}
}

// A reschedule never mutates the old appointment row — this moves whatever was
// financially attached to it onto the new row, so the old (now-inert) row carries
// nothing and the new row is the single source of truth going forward.
export async function moveFinancialLinksOnReschedule(
	oldAppointmentId: string,
	newAppointmentId: string,
	executor: Executor = db
) {
	await executor
		.update(payment)
		.set({ appointmentId: newAppointmentId })
		.where(eq(payment.appointmentId, oldAppointmentId));

	const [oldAppt] = await executor
		.select({ packId: appointment.packId })
		.from(appointment)
		.where(eq(appointment.id, oldAppointmentId));
	if (oldAppt?.packId) {
		await executor.update(appointment).set({ packId: oldAppt.packId }).where(eq(appointment.id, newAppointmentId));
		await executor.update(appointment).set({ packId: null }).where(eq(appointment.id, oldAppointmentId));
	}
}

// ---- the "who hasn't paid" view -----------------------------------------

// clientId is null for a walk-in (customName) charge — grouped by name instead, since
// there's no client row to key on. Packs are client-only (walk-ins never buy one), so
// every pack row has a real clientId.
export type ClientBalanceSummary = { key: string; clientId: string | null; name: string; owed: number };

// Sum of unpaid `payment` rows plus pending-payment packs, per client — what a client
// "owes" combines both charge types, since either one is money the therapist is waiting on.
export async function listOutstandingBalancesByClient(therapistId: string): Promise<ClientBalanceSummary[]> {
	const paymentRows = await db
		.select({
			clientId: payment.clientId,
			name: sql<string>`coalesce(${client.name}, ${payment.customName})`,
			owed: sql<number>`coalesce(sum(${payment.amount}), 0)::int`
		})
		.from(payment)
		.leftJoin(client, eq(payment.clientId, client.id))
		.where(and(eq(payment.therapistId, therapistId), eq(payment.status, 'unpaid')))
		.groupBy(payment.clientId, client.name, payment.customName);

	const packRows = await db
		.select({
			clientId: client.id,
			name: client.name,
			owed: sql<number>`coalesce(sum(${paymentPack.amount}), 0)::int`
		})
		.from(paymentPack)
		.innerJoin(client, eq(paymentPack.clientId, client.id))
		.where(and(eq(paymentPack.therapistId, therapistId), eq(paymentPack.status, 'pending_payment')))
		.groupBy(client.id, client.name);

	const byKey = new Map<string, ClientBalanceSummary>();
	for (const row of [...paymentRows, ...packRows]) {
		const key = row.clientId ?? `walkin:${row.name}`;
		const existing = byKey.get(key);
		if (existing) {
			existing.owed += row.owed;
		} else {
			byKey.set(key, { key, clientId: row.clientId, name: row.name, owed: row.owed });
		}
	}
	return [...byKey.values()].sort((a, b) => b.owed - a.owed);
}

export type MonthlyPaymentSummary = { paid: number; unpaid: number; total: number };

// Bucketed by when the charge was created — a therapist's "this month" is what
// originated this month, paid or not, same as any other created_at-scoped report.
export async function getMonthlyPaymentSummary(therapistId: string, year: number, month: number): Promise<MonthlyPaymentSummary> {
	const monthStart = new Date(Date.UTC(year, month, 1));
	const monthEnd = new Date(Date.UTC(year, month + 1, 1));

	const [row] = await db
		.select({
			paid: sql<number>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'paid'), 0)::int`,
			unpaid: sql<number>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'unpaid'), 0)::int`
		})
		.from(payment)
		.where(
			and(eq(payment.therapistId, therapistId), gte(payment.createdAt, monthStart), lt(payment.createdAt, monthEnd))
		);

	const paid = row?.paid ?? 0;
	const unpaid = row?.unpaid ?? 0;
	return { paid, unpaid, total: paid + unpaid };
}