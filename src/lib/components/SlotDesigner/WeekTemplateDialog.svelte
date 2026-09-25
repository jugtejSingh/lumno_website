<script lang="ts">
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import DayRail from './DayRail.svelte';
	import WeeklyDayEditor from './WeeklyDayEditor.svelte';
	import { provideHeldSlotsLookup } from './reservedSlotsContext';
	import type { WeeklyDay } from '$lib/types/slots';

	// Renders the stored week. Each slot, day setting and reservation saves on its own
	// (WeeklyDayEditor), and `week` refreshes after every save.
	let {
		week,
		clients,
		onclose
	}: {
		week: WeeklyDay[]; // index 0 = Sunday
		clients: { id: string; name: string }[];
		onclose: () => void;
	} = $props();

	// listed Monday-first, stored Sunday-first
	const dayOrder = [
		{ weekday: 1, name: 'Monday' },
		{ weekday: 2, name: 'Tuesday' },
		{ weekday: 3, name: 'Wednesday' },
		{ weekday: 4, name: 'Thursday' },
		{ weekday: 5, name: 'Friday' },
		{ weekday: 6, name: 'Saturday' },
		{ weekday: 0, name: 'Sunday' }
	];

	let selected = $state(1);

	function nameOfWeekday(weekday: number): string {
		for (const day of dayOrder) {
			if (day.weekday === weekday) {
				return day.name;
			}
		}
		return '';
	}

	// Returns e.g. "Tuesday 10:00–11:00" for every other slot the client holds.
	provideHeldSlotsLookup((clientId, exceptSlotId) => {
		const held: string[] = [];
		for (let weekday = 0; weekday < 7; weekday++) {
			for (const slot of week[weekday].slots) {
				if (slot.reservedClientId === clientId && slot.id !== exceptSlotId) {
					held.push(`${nameOfWeekday(weekday)} ${slot.startTime}–${slot.endTime}`);
				}
			}
		}
		return held;
	});

	// holidays and reserved slots don't count: clients can't book either
	const bookableSlotCount = $derived.by(() => {
		let total = 0;
		for (const day of week) {
			if (day.holiday) {
				continue;
			}
			for (const slot of day.slots) {
				if (!slot.reservedClientId) {
					total++;
				}
			}
		}
		return total;
	});
</script>

<Dialog open={true} title="Your weekly slots" width="clamp(320px, 70vw, 720px)" flush {onclose}>
	<div class="week-form">
		<DayRail days={dayOrder} {week} bind:selected />

		<div class="day-pane">
			<WeeklyDayEditor
				day={week[selected]}
				weekday={selected}
				dayName={nameOfWeekday(selected)}
				{dayOrder}
				{clients}
			/>

			<div class="footer">
				<span class="summary">
					{#if bookableSlotCount === 1}
						1 open slot a week
					{:else}
						{bookableSlotCount} open slots a week
					{/if}
				</span>
				<Button type="button" variant="secondary" onclick={onclose}>Done</Button>
			</div>
		</div>
	</div>
</Dialog>

<style>
	/* one height whichever day is picked, never taller than the screen */
	.week-form {
		display: flex;
		flex: 0 1 600px;
		min-height: 0;
	}

	.day-pane {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* Done stays reachable however long the day is */
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
		padding: 12px 18px;
		border-top: 2px solid var(--outline);
		background: var(--surface-card);
	}

	.summary {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-muted);
	}

	@media (max-width: 620px) {
		.week-form {
			flex-direction: column;
		}

		.footer {
			padding: 10px 16px;
		}
	}
</style>
