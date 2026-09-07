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
		<div class="toolbar-actions">
			<Button variant="secondary" onclick={goToday}>Today</Button>
		</div>
	</div>

	<MonthGrid {weeks} onDayClick={(day) => (dayDialogDay = day)} />
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
	}

	.month-nav {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.month-label {
		font-family: var(--font-display);
		font-size: 30px;
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
</style>