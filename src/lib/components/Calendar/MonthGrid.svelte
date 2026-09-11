<script lang="ts">
	import type { CalendarWeek } from '$lib/types/calendar';

	let {
		weeks,
		onDayClick
	}: {
		weeks: CalendarWeek[];
		onDayClick: (day: number) => void;
	} = $props();

	const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="grid">
	{#each weekdayLabels as wd (wd)}
		<div class="weekday">{wd}</div>
	{/each}
	{#each weeks as week (week.id)}
		{#each week.days as cell, di (di)}
			<div
				class="cell"
				class:today={cell.isToday}
				class:empty={cell.day === null}
				class:kind-online={cell.kind === 'online'}
				class:kind-in_person={cell.kind === 'in_person'}
				class:kind-off={cell.kind === 'off'}
				role="button"
				tabindex={cell.day !== null ? 0 : -1}
				onclick={() => cell.day !== null && onDayClick(cell.day)}
				onkeydown={(e) => {
					if (cell.day !== null && (e.key === 'Enter' || e.key === ' ')) onDayClick(cell.day);
				}}
			>
				{#if cell.day !== null}
					<div class="cell-num" class:today={cell.isToday}>{cell.day}</div>
					<div class="cell-sessions">
						{#each cell.sessions as s (s.time + s.name)}
							<div
								class="session-chip"
								class:dim={s.status === 'cancelled' || s.status === 'rescheduled'}
								class:struck={s.status === 'cancelled'}
								style="background: {s.color}"
							>
								<span class="session-time">{s.time}</span>
								{s.name}
							</div>
						{/each}
						{#if cell.extraCount > 0}
							<div class="extra">+{cell.extraCount} more</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 8px;
	}

	/* ponytail: 7 columns can't get narrower, so on small screens tighten the
	   cells instead — smaller gap/padding/min-height keeps the month on screen */
	@media (max-width: 640px) {
		.grid {
			gap: 3px;
		}

		.cell {
			min-height: 58px;
			padding: 4px;
			gap: 3px;
		}

		.weekday {
			font-size: 10px;
		}

		.session-chip {
			font-size: 9px;
			padding: 2px 3px;
		}

		.cell-num {
			font-size: 11px;
		}

		.extra {
			font-size: 9px;
		}
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
		cursor: pointer;
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.cell.today {
		border-color: var(--plum-400);
		box-shadow: inset 0 0 0 1px var(--plum-400);
	}

	.cell.empty {
		cursor: default;
	}

	/* in-person days keep the default beige surface */
	.cell.kind-in_person {
		background: var(--beige-200);
	}

	.cell.kind-online {
		background: var(--sage-300);
	}

	.cell.kind-off {
		background: var(--beige-200);
		filter: grayscale(1);
		opacity: 0.6;
	}

	.cell-num {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.cell-num.today {
		color: var(--plum-700);
	}

	.cell-sessions {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.session-chip {
		border-radius: var(--radius-sm);
		padding: 3px 6px;
		font-size: 11px;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
</style>
