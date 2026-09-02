<script lang="ts">
	import { getMonthGridWeeks } from '$lib/monthGrid';
	import type { AvailableSlot } from '$lib/server/availability';

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

	const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const today = new Date();
	const weeks = $derived(getMonthGridWeeks(year, month));
	const modalityHint: Record<string, string> = { online: 'Online', in_person: 'In Person' };

	function isToday(day: number | null) {
		return day !== null && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
	}
</script>

<div class="grid">
	{#each weekdayLabels as wd (wd)}
		<div class="weekday">{wd}</div>
	{/each}
	{#each weeks as week, wi (wi)}
		{#each week as day, di (di)}
			{@const slots = day !== null ? (slotsByDay[day] ?? []) : []}
			{@const available = slots.length > 0}
			<div
				class="cell"
				class:empty={day === null}
				class:available
				class:today={isToday(day)}
				role="button"
				tabindex={available ? 0 : -1}
				onclick={() => available && day !== null && onDayClick(day)}
				onkeydown={(e) => {
					if (available && day !== null && (e.key === 'Enter' || e.key === ' ')) onDayClick(day);
				}}
			>
				{#if day !== null}
					<div class="cell-num">{day}</div>
					{#if available}
						<div class="cell-hint">{modalityHint[slots[0].modality] ?? 'Book'}</div>
					{/if}
				{/if}
			</div>
		{/each}
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 8px;
	}

	.weekday {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		text-align: center;
		padding: 4px 0;
	}

	.cell {
		min-height: 64px;
		padding: 8px;
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 4px;
		cursor: default;
	}

	.cell.empty {
		border-color: transparent;
		background: transparent;
	}

	.cell.today {
		border-color: var(--plum-400);
		box-shadow: inset 0 0 0 1px var(--plum-400);
	}

	.cell.available {
		background: var(--sage-300);
		cursor: pointer;
	}

	.cell-num {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.cell-hint {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
	}
</style>