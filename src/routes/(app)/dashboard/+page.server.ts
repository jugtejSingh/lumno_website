import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { appointment, client, clientNote } from '$lib/server/db/schema';
import { getZonedDateParts } from '$lib/server/timezone';
import { listOutstandingBalancesByClient } from '$lib/server/payments';
import { formatCurrency } from '$lib/format';
import type { DashboardStat, UpcomingSession } from '$lib/types/dashboard';

const ACTIVE_STATUSES = ['confirmed', 'completed'] as const;

function weekStart(from: Date): Date {
	const start = new Date(from);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - start.getDay()); // Sunday
	return start;
}

function addDays(date: Date, days: number): Date {
	const copy = new Date(date);
	copy.setDate(copy.getDate() + days);
	return copy;
}

// "Today · 2:00 PM" / "Tomorrow · 10:00 AM" / "Thu · 9:30 AM", in the therapist's own timezone.
function formatUpcoming(startAt: Date, timezone: string): string {
	const today = getZonedDateParts(new Date(), timezone);
	const day = getZonedDateParts(startAt, timezone);
	const dayDiff = Math.round(
		(Date.UTC(day.year, day.month, day.day) - Date.UTC(today.year, today.month, today.day)) / 86_400_000
	);
	const prefix =
		dayDiff === 0
			? 'Today'
			: dayDiff === 1
				? 'Tomorrow'
				: new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(startAt);
	const time = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(
		startAt
	);
	return `${prefix} · ${time}`;
}

async function countAppointmentsInRange(therapistId: string, start: Date, end: Date): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(appointment)
		.where(
			and(
				eq(appointment.therapistId, therapistId),
				inArray(appointment.status, ACTIVE_STATUSES),
				gte(appointment.startAt, start),
				lt(appointment.startAt, end)
			)
		);
	return row?.count ?? 0;
}

// ponytail: sessions older than `since` are treated as write-offs, not nags — they drop off the count.
async function countNotesOverdue(therapistId: string, since: Date): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(appointment)
		.leftJoin(clientNote, eq(clientNote.appointmentId, appointment.id))
		.where(
			and(
				eq(appointment.therapistId, therapistId),
				eq(appointment.status, 'completed'),
				isNull(clientNote.id),
				gte(appointment.startAt, since)
			)
		);
	return row?.count ?? 0;
}

export const load: PageServerLoad = async (event) => {
	const { user, therapist } = await event.parent();
	const therapistId = therapist.id;
	const timezone = therapist.timezone;

	// ponytail: private (this therapist's browser only, never a shared/CDN cache) + short
	// max-age so back/forward nav and quick reloads skip the DB. Raise or drop if stats
	// need to feel more/less instant after a booking or payment.
	event.setHeaders({ 'cache-control': 'private, max-age=60' });

	const now = new Date();
	const thisWeekStart = weekStart(now);
	const nextWeekStart = addDays(thisWeekStart, 7);
	const lastWeekStart = addDays(thisWeekStart, -7);

	const [
		sessionsThisWeek,
		sessionsLastWeek,
		notesOverdue,
		outstandingBalances,
		upcomingRows
	] = await Promise.all([
		countAppointmentsInRange(therapistId, thisWeekStart, nextWeekStart),
		countAppointmentsInRange(therapistId, lastWeekStart, thisWeekStart),
		countNotesOverdue(therapistId, lastWeekStart),
		listOutstandingBalancesByClient(therapistId),
		db
			.select({ name: sql<string>`coalesce(${client.name}, ${appointment.customName})`, startAt: appointment.startAt })
			.from(appointment)
			.leftJoin(client, eq(appointment.clientId, client.id))
			.where(
				and(eq(appointment.therapistId, therapistId), eq(appointment.status, 'confirmed'), gte(appointment.startAt, now))
			)
			.orderBy(appointment.startAt)
			.limit(4)
	]);

	const outstandingTotal = outstandingBalances.reduce((sum, row) => sum + row.owed, 0);
	const sessionsDelta = sessionsThisWeek - sessionsLastWeek;

	const stats: DashboardStat[] = [
		{
			label: 'Sessions this week',
			value: String(sessionsThisWeek),
			accent: 'plum',
			delta: sessionsDelta === 0 ? undefined : `${sessionsDelta > 0 ? '+' : ''}${sessionsDelta} vs last week`
		},
		{ label: 'Notes overdue', value: String(notesOverdue), accent: 'citrus' },
		{ label: 'Outstanding balance', value: formatCurrency(outstandingTotal, therapist.currency), accent: 'sage' }
	];

	const upcoming: UpcomingSession[] = upcomingRows.map((row) => ({
		name: row.name,
		next: formatUpcoming(row.startAt, timezone),
		status: 'confirmed',
		tone: 'success',
		notesHref: `/notes?client=${encodeURIComponent(row.name)}`
	}));

	return {
		therapistName: user.name,
		todayCount: upcoming.filter((s) => s.next.startsWith('Today')).length,
		stats,
		upcoming
	};
};
