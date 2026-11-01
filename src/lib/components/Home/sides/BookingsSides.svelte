<script lang="ts">
	import type { Face } from './face';

	let { face }: { face: Face } = $props();

	type Slot = { time: string; client?: string };
	type Day = { day: string; slots: Slot[] };

	// one week drives both faces, so the client view is always "your week minus taken slots"
	const week: Day[] = [
		{ day: 'Mon', slots: [{ time: '10:00', client: 'Priya' }, { time: '4:00' }] },
		{ day: 'Tue', slots: [{ time: '11:00' }, { time: '2:00', client: 'Arjun' }] },
		{
			day: 'Wed',
			slots: [
				{ time: '9:30', client: 'Maria' },
				{ time: '1:00', client: 'Dev' }
			]
		},
		{ day: 'Thu', slots: [{ time: '12:00' }, { time: '4:00' }] },
		{ day: 'Fri', slots: [{ time: '10:00', client: 'Sana' }, { time: '3:00' }] }
	];

	function openSlotsOnly(days: Day[]): Day[] {
		const result: Day[] = [];
		for (const day of days) {
			const open: Slot[] = [];
			for (const slot of day.slots) {
				if (!slot.client) {
					open.push(slot);
				}
			}
			result.push({ day: day.day, slots: open });
		}
		return result;
	}

	const clientWeek = openSlotsOnly(week);
	const pickedDay = 'Thu';
	const pickedTime = '4:00';
</script>

{#if face === 'you'}
	<div class="title">Your week</div>
	<div class="week">
		{#each week as day (day.day)}
			<div class="col">
				<div class="day">{day.day}</div>
				{#each day.slots as slot (slot.time)}
					{#if slot.client}
						<div class="slot booked">
							<span class="time">{slot.time}</span>
							{slot.client}
						</div>
					{:else}
						<div class="slot open">
							<span class="time">{slot.time}</span>
							Open
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
	<p class="caption">
		Sessions land here the moment a client books, with a Google Meet link made for you.
	</p>
{:else}
	<div class="title">Pick a time that suits you</div>
	<div class="week">
		{#each clientWeek as day (day.day)}
			<div class="col">
				<div class="day">{day.day}</div>
				{#each day.slots as slot (slot.time)}
					{#if day.day === pickedDay && slot.time === pickedTime}
						<div class="slot picked">{slot.time}</div>
					{:else}
						<div class="slot choice">{slot.time}</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
	<div class="confirm">Book Thu, 4:00 pm →</div>
	<p class="caption">Your client only ever sees the times you're free, never who has the rest.</p>
{/if}

<style>
	.week {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
	}

	.col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.day {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--text-muted);
		text-align: center;
	}

	.slot {
		font-size: 13px;
		font-weight: 600;
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
		padding: 8px 6px;
		text-align: center;
		min-height: 54px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow-wrap: anywhere;
	}

	.time {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.booked {
		background: var(--plum-300);
		box-shadow: var(--shadow-xs);
	}

	.open {
		border-style: dashed;
		color: var(--text-muted);
	}

	.choice {
		background: var(--surface-card);
		box-shadow: var(--shadow-xs);
	}

	.picked {
		background: var(--sage-300);
		box-shadow: var(--shadow-sm);
	}

	.confirm {
		margin-top: 18px;
		display: inline-block;
		font-weight: 700;
		background: var(--accent-primary);
		color: var(--text-on-accent);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-sm);
		padding: 10px 20px;
	}
</style>
