<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$lib/enhance';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import DaySlotsEditor from './DaySlotsEditor.svelte';
	import MaxSessionsInput from './MaxSessionsInput.svelte';
	import type { DesignedDay } from '$lib/types/slots';

	// mounted only while open (see calendar +page.svelte), so the draft is seeded fresh each time
	let {
		week,
		message,
		onclose
	}: {
		week: DesignedDay[]; // index 0 = Sunday
		message?: string;
		onclose: () => void;
	} = $props();

	let draft = $state(untrack(() => $state.snapshot(week)));

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

	function copyDay(fromWeekday: number, target: string) {
		const targets: number[] = [];
		if (target === 'all') {
			for (let weekday = 0; weekday < 7; weekday++) {
				targets.push(weekday);
			}
		} else if (target === 'weekdays') {
			for (let weekday = 1; weekday <= 5; weekday++) {
				targets.push(weekday);
			}
		} else {
			targets.push(Number(target));
		}

		for (const weekday of targets) {
			if (weekday !== fromWeekday) {
				draft[weekday] = $state.snapshot(draft[fromWeekday]);
			}
		}
	}
</script>

<Dialog open={true} title="Your weekly slots" width="clamp(320px, 60vw, 760px)" {onclose}>
	<form
		class="week-form"
		method="POST"
		action="?/saveWeekTemplate"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					onclose();
				}
				await update();
			};
		}}
	>
		<p class="intro">
			Build each day slot by slot — these are exactly the times clients can book. Change a single date
			from the calendar by clicking it.
		</p>
		<input type="hidden" name="week" value={JSON.stringify(draft)} />

		{#each dayOrder as { weekday, name } (weekday)}
			<section class="day">
				<div class="day-header">
					<span class="day-name">{name}</span>
					<span class="day-count">
						{#if draft[weekday].slots.length === 0}
							off
						{:else if draft[weekday].slots.length === 1}
							1 slot
						{:else}
							{draft[weekday].slots.length} slots
						{/if}
					</span>
					{#if draft[weekday].slots.length > 0}
						<select
							class="copy-select"
							aria-label="Copy {name} to other days"
							value=""
							onchange={(event) => {
								copyDay(weekday, event.currentTarget.value);
								event.currentTarget.value = '';
							}}
						>
							<option value="" disabled>Copy to…</option>
							<option value="weekdays">Mon – Fri</option>
							<option value="all">Every day</option>
							{#each dayOrder as other (other.weekday)}
								{#if other.weekday !== weekday}
									<option value={other.weekday}>{other.name}</option>
								{/if}
							{/each}
						</select>
					{/if}
				</div>
				<DaySlotsEditor bind:slots={draft[weekday].slots} />
				{#if draft[weekday].slots.length > 0}
					<MaxSessionsInput bind:value={draft[weekday].maxSessions} />
				{/if}
			</section>
		{/each}

		{#if message}
			<div class="form-error">{message}</div>
		{/if}
		<div class="actions">
			<Button type="button" variant="secondary" onclick={onclose}>Cancel</Button>
			<Button type="submit" variant="primary">Save weekly slots</Button>
		</div>
	</form>
</Dialog>

<style>
	.week-form {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.intro {
		margin: 0;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.day {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 14px;
		border-bottom: 2px dashed var(--border-subtle);
	}

	.day-header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.day-name {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 18px;
		color: var(--text-primary);
	}

	.day-count {
		font-size: 12px;
		color: var(--text-muted);
	}

	.copy-select {
		margin-left: auto;
		font-family: var(--font-body);
		font-size: 12px;
		padding: 4px 8px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-secondary);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}
</style>
