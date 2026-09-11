<script lang="ts">
	import Button from '$lib/components/utils/Button.svelte';
	import MonthGrid from '$lib/components/Calendar/MonthGrid.svelte';
	import DayDialog from '$lib/components/Calendar/DayDialog.svelte';
	import TodayDialog from '$lib/components/Calendar/TodayDialog.svelte';
	import { goto } from '$app/navigation';
	import type { ActionData, PageData } from './$types';
	import type { CalendarDay, CalendarWeek } from '$lib/types/calendar';

	// month grid, padded with leading/trailing nulls so it lines up on 7 columns, chunked into weeks
	function getMonthGridWeeks(year: number, month: number): (number | null)[][] {
		const firstWeekday = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		const days: (number | null)[] = [];
		for (let i = 0; i < firstWeekday; i++) days.push(null);
		for (let d = 1; d <= daysInMonth; d++) days.push(d);
		while (days.length % 7 !== 0) days.push(null);

		const weeks: (number | null)[][] = [];
		for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
		return weeks;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const today = new Date();
	let year = $derived(data.year);
	let month = $derived(data.month);

	let dayDialogDay = $state<number | null>(null);
	let todayDialogOpen = $state(false);

	// single-day view for phones (see .day-view in styles). Starts on today's
	// date-of-month; the calendar loads the current month by default.
	// ponytail: deep-linking ?month= to another month lands on the same day number,
	// clamped — fine, the arrows move from there
	let selectedDay = $state(today.getDate());
	const daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
	// ponytail: clamp instead of syncing selectedDay to month changes — only matters
	// if a desktop user month-navigates then shrinks to phone width
	const safeSelectedDay = $derived(Math.min(selectedDay, daysInMonth));
	const dayViewLabel = $derived(
		new Date(year, month, safeSelectedDay).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		})
	);
	const dayViewSessions = $derived(data.sessionsByDay[safeSelectedDay] ?? []);

	function stepDay(delta: number) {
		const next = safeSelectedDay + delta;
		if (next < 1) {
			const pm = month === 0 ? 11 : month - 1;
			const py = month === 0 ? year - 1 : year;
			selectedDay = new Date(py, pm + 1, 0).getDate();
			gotoMonth(py, pm);
		} else if (next > daysInMonth) {
			selectedDay = 1;
			gotoMonth(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
		} else {
			selectedDay = next;
		}
	}

	const monthLabel = $derived(
		new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	);

	function toCalendarDay(day: number | null): CalendarDay {
		if (day === null) return { day: null, isToday: false, sessions: [], extraCount: 0, kind: null };

		const sessions = data.sessionsByDay[day] ?? [];
		const visible = sessions.slice(0, 2);
		return {
			day,
			isToday: day === today.getDate() && month === today.getMonth() && year === today.getFullYear(),
			sessions: visible,
			extraCount: sessions.length - visible.length,
			kind: data.dayKinds[day] ?? null
		};
	}

	const weeks: CalendarWeek[] = $derived(
		getMonthGridWeeks(year, month).map((week, i) => ({ id: i * 7, days: week.map(toCalendarDay) }))
	);

	const dayDialogSessions = $derived(dayDialogDay !== null ? (data.sessionsByDay[dayDialogDay] ?? []) : []);
	const todaySessions = $derived(data.sessionsByDay[today.getDate()] ?? []);

	function gotoMonth(nextYear: number, nextMonth: number) {
		goto(`?year=${nextYear}&month=${nextMonth}`, { keepFocus: true });
	}

	function prevMonth() {
		gotoMonth(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
	}

	function nextMonth() {
		gotoMonth(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
	}

	function goToday() {
		selectedDay = today.getDate();
		gotoMonth(today.getFullYear(), today.getMonth());
		todayDialogOpen = true;
	}
</script>

<div class="calendar">
	<div class="toolbar">
		<div class="month-nav">
			<div class="month-label">{monthLabel}</div>
			<div class="month-arrows">
				<button class="arrow-btn" onclick={prevMonth} aria-label="Previous month">&#8249;</button>
				<button class="arrow-btn" onclick={nextMonth} aria-label="Next month">&#8250;</button>
			</div>
		</div>
		<div class="day-nav">
			<button class="arrow-btn" onclick={() => stepDay(-1)} aria-label="Previous day">&#8249;</button>
			<div class="month-label">{dayViewLabel}</div>
			<button class="arrow-btn" onclick={() => stepDay(1)} aria-label="Next day">&#8250;</button>
		</div>
		<div class="toolbar-actions">
			<Button variant="secondary" onclick={goToday}>Today</Button>
		</div>
	</div>

	<div class="month-view">
		<MonthGrid {weeks} onDayClick={(day) => (dayDialogDay = day)} />
	</div>

	<div class="day-view">
		{#if dayViewSessions.length === 0}
			<button class="day-empty" onclick={() => (dayDialogDay = safeSelectedDay)}>
				No sessions this day. Tap to add one.
			</button>
		{:else}
			<ul class="day-list">
				{#each dayViewSessions as session (session.id)}
					<li>
						<button
							class="day-row"
							class:dim={session.status === 'cancelled' || session.status === 'rescheduled'}
							onclick={() => (dayDialogDay = safeSelectedDay)}
						>
							<span class="day-row-time">{session.time}</span>
							<span class="day-row-name">{session.name}</span>
							<span class="day-row-modality">{session.modalityLabel}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<DayDialog
	day={dayDialogDay}
	{year}
	{month}
	sessions={dayDialogSessions}
	clients={data.clients}
	formMessage={form?.message}
	onclose={() => (dayDialogDay = null)}
/>

<TodayDialog open={todayDialogOpen} sessions={todaySessions} onclose={() => (todayDialogOpen = false)} />

<style>
	.calendar {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px;
	}

	.month-nav {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.month-label {
		font-family: var(--font-display);
		font-size: clamp(22px, 5vw, 30px);
		color: var(--text-primary);
	}

	.month-arrows {
		display: flex;
		gap: 6px;
	}

	.arrow-btn {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-card);
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
	}

	.toolbar-actions {
		display: flex;
		gap: 10px;
	}

	/* desktop: month grid only; the single-day view is phone-only */
	.day-nav,
	.day-view {
		display: none;
	}

	.day-view {
		flex-direction: column;
		gap: 12px;
		align-items: center;
		text-align: center;
	}

	.day-list {
		list-style: none;
		margin: 0;
		padding: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.day-row {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 10px;
		width: 100%;
		padding: 12px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-card);
		font-family: var(--font-body);
		cursor: pointer;
	}

	.day-row.dim {
		opacity: 0.55;
	}

	.day-row-time {
		font-weight: 700;
		color: var(--text-primary);
	}

	.day-row-name {
		color: var(--text-primary);
	}

	.day-row-modality {
		font-size: 12px;
		color: var(--text-muted);
	}

	.day-empty {
		width: 100%;
		padding: 24px 12px;
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-md);
		background: transparent;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-muted);
		cursor: pointer;
	}

	@media (max-width: 640px) {
		.month-nav,
		.month-view {
			display: none;
		}

		.toolbar {
			justify-content: center;
		}

		.day-nav {
			display: flex;
			align-items: center;
			gap: 14px;
			flex: 1 1 100%;
			justify-content: space-between;
		}

		.day-nav .month-label {
			flex: 1;
			text-align: center;
		}

		.toolbar-actions {
			flex: 1 1 100%;
			justify-content: center;
		}

		.day-view {
			display: flex;
		}
	}
</style>