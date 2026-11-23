<script lang="ts">
	import type { Snippet } from 'svelte';

	// Shared look for every month calendar: weekday header, cell box, today ring,
	// selected day, day tones and the square phone layout. What goes inside a cell
	// and which days can be clicked is up to the wrapper (MonthGrid, PortalMonthGrid).
	let {
		weeks,
		isToday,
		canClick,
		onDayClick,
		tone = () => null,
		selectedDay = null,
		cell
	}: {
		weeks: (number | null)[][];
		isToday: (day: number) => boolean;
		canClick: (day: number) => boolean;
		onDayClick: (day: number) => void;
		tone?: (day: number) => 'available' | 'off' | null;
		selectedDay?: number | null;
		cell: Snippet<[number]>;
	} = $props();

	const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function handleKey(event: KeyboardEvent, day: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onDayClick(day);
		}
	}
</script>

<div class="grid">
	{#each weekdayLabels as wd (wd)}
		<div class="weekday">{wd}</div>
	{/each}
	{#each weeks as week, wi (wi)}
		{#each week as day, di (di)}
			{#if day === null}
				<div class="cell empty"></div>
			{:else if canClick(day)}
				<div
					class="cell clickable"
					class:today={isToday(day)}
					class:selected={day === selectedDay}
					class:tone-available={tone(day) === 'available'}
					class:tone-off={tone(day) === 'off'}
					role="button"
					tabindex="0"
					onclick={() => onDayClick(day)}
					onkeydown={(event) => handleKey(event, day)}
				>
					<div class="cell-num">{day}</div>
					{@render cell(day)}
				</div>
			{:else}
				<div
					class="cell"
					class:today={isToday(day)}
					class:tone-available={tone(day) === 'available'}
					class:tone-off={tone(day) === 'off'}
				>
					<div class="cell-num">{day}</div>
					{@render cell(day)}
				</div>
			{/if}
		{/each}
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
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
		min-height: 92px;
		padding: 8px;
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
		border: 1px solid var(--beige-400);
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.cell.clickable {
		cursor: pointer;
	}

	.cell.empty {
		background: var(--coral-100);
	}

	.cell.today {
		border-color: var(--outline);
		box-shadow: var(--shadow-sm);
	}

	.cell.tone-available {
		background: var(--coral-300);
		border-color: var(--coral-600);
	}

	.cell.tone-off {
		background: repeating-linear-gradient(135deg, var(--beige-200) 0 6px, var(--beige-50) 6px 12px);
		border-style: dashed;
		opacity: 0.6;
	}

	.cell-num {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.cell.today .cell-num {
		color: var(--plum-700);
	}

	/* phones: 7 columns stay, cells go square with a centred number */
	@media (max-width: 640px) {
		.grid {
			gap: 4px;
		}

		.weekday {
			font-size: 11px;
			letter-spacing: 0;
		}

		.cell {
			min-height: 0;
			aspect-ratio: 1;
			padding: 2px;
			gap: 3px;
			align-items: center;
			justify-content: center;
		}

		.cell.selected {
			border-color: var(--outline);
			background: var(--plum-300);
		}

		.cell-num {
			font-size: 15px;
		}
	}
</style>
