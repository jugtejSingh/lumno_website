<script lang="ts">
	import CalendarGrid from './CalendarGrid.svelte';
	import type { CalendarDay, CalendarWeek } from '$lib/types/calendar';

	// Therapist calendar: every day is clickable; cells show session chips
	// (dots on phones) and off days are hatched.
	let {
		weeks,
		onDayClick,
		selectedDay = null
	}: {
		weeks: CalendarWeek[];
		onDayClick: (day: number) => void;
		// highlighted on phones, where the day's sessions are listed under the grid
		selectedDay?: number | null;
	} = $props();

	const dayNumbers = $derived.by(() => {
		const result: (number | null)[][] = [];
		for (const week of weeks) {
			const row: (number | null)[] = [];
			for (const cell of week.days) {
				row.push(cell.day);
			}
			result.push(row);
		}
		return result;
	});

	const daysByNumber = $derived.by(() => {
		const result: Record<number, CalendarDay> = {};
		for (const week of weeks) {
			for (const cell of week.days) {
				if (cell.day !== null) {
					result[cell.day] = cell;
				}
			}
		}
		return result;
	});

	function tone(day: number): 'off' | null {
		if (daysByNumber[day]?.kind === 'off') {
			return 'off';
		}
		return null;
	}
</script>

<CalendarGrid
	weeks={dayNumbers}
	isToday={(day) => daysByNumber[day]?.isToday ?? false}
	canClick={() => true}
	{onDayClick}
	{tone}
	{selectedDay}
>
	{#snippet cell(day: number)}
		{@const info = daysByNumber[day]}
		{#if info}
			<div class="cell-sessions">
				{#each info.sessions as s (s.id)}
					<div
						class="session-chip"
						class:dim={s.status === 'cancelled' || s.status === 'rescheduled'}
						class:struck={s.status === 'cancelled'}
						class:done={s.status === 'completed'}
						style="background: {s.color}"
					>
						<span class="session-time">{s.time}</span>
						{s.name}
					</div>
				{/each}
				{#if info.extraCount > 0}
					<div class="extra">+{info.extraCount} more</div>
				{/if}
			</div>
			<!-- phone-only: chips don't fit, so each session is a dot in its colour -->
			<div class="cell-dots">
				{#each info.sessions as s (s.id)}
					<span
						class="dot"
						class:dim={s.status === 'cancelled' || s.status === 'rescheduled'}
						style="background: {s.color}"
					></span>
				{/each}
				{#if info.extraCount > 0}
					<span class="dot-extra">+</span>
				{/if}
			</div>
		{/if}
	{/snippet}
</CalendarGrid>

<style>
	.cell-sessions {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.session-chip {
		border: 1.5px solid var(--outline);
		border-radius: var(--radius-sm);
		padding: 3px 6px;
		font-size: 11px;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* completed sessions are filled solid brown so done vs upcoming reads at a glance */
	.session-chip.done {
		color: var(--beige-0);
	}

	.session-chip.dim {
		opacity: 0.55;
	}

	.session-chip.struck {
		text-decoration: line-through;
	}

	.session-time {
		font-weight: 700;
	}

	.extra {
		font-size: 11px;
		color: var(--text-muted);
		padding-left: 2px;
	}

	.cell-dots {
		display: none;
	}

	@media (max-width: 640px) {
		.cell-sessions {
			display: none;
		}

		.cell-dots {
			display: flex;
			align-items: center;
			gap: 3px;
			min-height: 7px;
		}

		.dot {
			width: 7px;
			height: 7px;
			border-radius: 50%;
			border: 1px solid var(--outline);
		}

		.dot.dim {
			opacity: 0.45;
		}

		.dot-extra {
			font-size: 10px;
			font-weight: 700;
			line-height: 7px;
			color: var(--text-muted);
		}
	}
</style>
