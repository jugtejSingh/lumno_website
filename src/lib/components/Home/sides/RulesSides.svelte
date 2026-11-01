<script lang="ts">
	import type { Face } from './face';

	let { face }: { face: Face } = $props();

	const days = [
		{ day: 'Mon', working: true },
		{ day: 'Tue', working: true },
		{ day: 'Wed', working: false },
		{ day: 'Thu', working: true },
		{ day: 'Fri', working: true }
	];

	const rules = [
		{ label: 'Most sessions in a day', value: '4' },
		{ label: 'Clients can book up to', value: '4 weeks ahead' },
		{ label: 'Holiday', value: '1–5 Nov' },
		{ label: 'Kept for Arjun', value: 'Every Tue, 2:00 pm' }
	];

	const openTimes = ['Mon 10:00', 'Thu 12:00', 'Thu 4:00', 'Fri 3:00'];
</script>

{#if face === 'you'}
	<div class="title">Your rules</div>
	<div class="days">
		{#each days as day (day.day)}
			{#if day.working}
				<span class="chip chip-plum">{day.day}</span>
			{:else}
				<span class="chip off">{day.day} · off</span>
			{/if}
		{/each}
	</div>
	<div class="rows">
		{#each rules as rule (rule.label)}
			<div class="row">
				<span class="muted">{rule.label}</span>
				<span>{rule.value}</span>
			</div>
		{/each}
	</div>
	<p class="caption">
		Set your hours week by week or day by day. Change anything, any time, and bookings follow.
	</p>
{:else}
	<div class="title">Hi Arjun</div>
	<div class="regular">
		<span class="muted">Your regular session</span>
		Every Tuesday, 2:00 pm
		<span class="chip chip-sage">✓ Booked for you</span>
	</div>
	<div class="muted extra">Want an extra session?</div>
	<div class="days">
		{#each openTimes as time (time)}
			<span class="chip time">{time}</span>
		{/each}
	</div>
	<div class="away">Away 1–5 Nov</div>
	<p class="caption">
		Clients only see what your rules allow. No Wednesdays, no fifth session, nothing past four
		weeks.
	</p>
{/if}

<style>
	.days {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 14px;
	}

	.off {
		border-style: dashed;
		color: var(--text-muted);
	}

	.time {
		background: var(--surface-card);
		box-shadow: var(--shadow-xs);
		font-size: 13px;
		padding: 6px 12px;
	}

	.regular {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		font-weight: 700;
		font-size: 18px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		background: var(--surface-card);
		box-shadow: var(--shadow-sm);
		padding: 14px 16px;
		margin-bottom: 18px;
	}

	.extra {
		margin-bottom: 8px;
	}

	.away {
		display: inline-block;
		font-size: 13px;
		font-weight: 700;
		background: var(--coral-300);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		padding: 4px 12px;
	}
</style>
