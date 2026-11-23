<script lang="ts">
	import CalendarGrid from './CalendarGrid.svelte';
	import { getMonthGridWeeks } from '$lib/monthGrid';
	import type { AvailableSlot } from '$lib/server/availability';

	// Client booking calendar: only days with open slots are clickable and tinted.
	// Never shows why a day is unavailable — just that it has no open slots.
	let {
		year,
		month,
		slotsByDay,
		onDayClick
	}: {
		year: number;
		month: number;
		slotsByDay: Record<number, AvailableSlot[]>;
		onDayClick: (day: number) => void;
	} = $props();

	const today = new Date();
	const weeks = $derived(getMonthGridWeeks(year, month));
	const modalityHint: Record<string, string> = {
		online: 'Online',
		in_person: 'In Person',
		hybrid: 'Choose'
	};

	function isAvailable(day: number): boolean {
		const slots = slotsByDay[day] ?? [];
		return slots.length > 0;
	}

	function isToday(day: number): boolean {
		return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
	}

	function tone(day: number): 'available' | null {
		if (isAvailable(day)) {
			return 'available';
		}
		return null;
	}
</script>

<p class="mobile-legend">
	<span class="legend-swatch"></span>
	Days in this colour are available. Tap one to see the times for that day.
</p>

<CalendarGrid {weeks} {isToday} canClick={isAvailable} {onDayClick} {tone}>
	{#snippet cell(day: number)}
		{#if isAvailable(day)}
			<div class="cell-hint">{modalityHint[slotsByDay[day][0].modality] ?? 'Book'}</div>
		{/if}
	{/snippet}
</CalendarGrid>

<style>
	/* only shown on mobile, where the per-day hints are hidden */
	.mobile-legend {
		display: none;
		align-items: center;
		gap: 8px;
		margin: 0 0 10px;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.legend-swatch {
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		border-radius: 4px;
		background: var(--coral-300);
		border: 2px solid var(--coral-600);
	}

	.cell-hint {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	@media (max-width: 640px) {
		.mobile-legend {
			display: flex;
		}

		.cell-hint {
			display: none;
		}
	}
</style>
