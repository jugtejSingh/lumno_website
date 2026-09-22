<script lang="ts">
	import type { WeeklyDay } from '$lib/types/slots';

	// The weekly dialog's list of days: pick one to edit it. A column beside the editor,
	// a scrolling strip above it on a phone.
	let {
		days,
		week,
		selected = $bindable()
	}: {
		days: { weekday: number; name: string }[];
		week: WeeklyDay[]; // index 0 = Sunday
		selected: number;
	} = $props();

	function statusLabel(day: WeeklyDay): string {
		if (day.holiday) {
			return 'holiday';
		}
		if (day.slots.length === 0) {
			return 'off';
		}
		return String(day.slots.length);
	}
</script>

<nav class="rail" aria-label="Days of the week">
	<div class="rail-title">Days</div>
	{#each days as { weekday, name } (weekday)}
		<button
			type="button"
			class="rail-day"
			class:selected={selected === weekday}
			class:closed={week[weekday].holiday || week[weekday].slots.length === 0}
			aria-current={selected === weekday}
			onclick={() => (selected = weekday)}
		>
			<span class="day-name">{name.slice(0, 3)}</span>
			<span class="day-status">{statusLabel(week[weekday])}</span>
		</button>
	{/each}
</nav>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 160px;
		flex-shrink: 0;
		padding: 12px 10px;
		background: var(--surface-sunken);
		border-right: 2px solid var(--outline);
		/* scrolls itself rather than stretching the dialog */
		overflow-y: auto;
	}

	.rail-title {
		padding: 0 8px 6px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.rail-day {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		border: 2px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
		text-align: left;
	}

	.rail-day:hover {
		background: var(--surface-card);
	}

	.rail-day.selected {
		border-color: var(--outline);
		background: var(--surface-card);
		box-shadow: var(--shadow-xs);
	}

	.rail-day.closed {
		opacity: 0.55;
	}

	.rail-day.selected.closed {
		opacity: 1;
	}

	.day-status {
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 700;
		color: var(--text-muted);
	}

	/* on a phone the rail turns into a strip of day chips above the editor */
	@media (max-width: 620px) {
		.rail {
			flex-direction: row;
			width: auto;
			flex-shrink: 0;
			padding: 8px;
			overflow-x: auto;
			overflow-y: hidden;
			border-right: none;
			border-bottom: 2px solid var(--outline);
		}

		.rail-title {
			display: none;
		}

		.rail-day {
			flex-direction: column;
			gap: 2px;
			flex-shrink: 0;
			padding: 6px 10px;
		}
	}
</style>
