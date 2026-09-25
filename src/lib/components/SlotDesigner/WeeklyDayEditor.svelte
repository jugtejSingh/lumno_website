<script lang="ts">
	import WeeklySlotRow from './WeeklySlotRow.svelte';
	import HolidayToggle from './HolidayToggle.svelte';
	import MaxSessionsInput from './MaxSessionsInput.svelte';
	import { nextSlot } from './nextSlot';
	import { postSlotAction } from './slotActions';
	import type { WeeklyDay } from '$lib/types/slots';

	// One weekday of the weekly template, as stored. Every control saves straight away through
	// its own action; the page data reloads after each, which refreshes `day`.
	let {
		day,
		weekday,
		dayName,
		dayOrder,
		clients
	}: {
		day: WeeklyDay;
		weekday: number;
		dayName: string;
		dayOrder: { weekday: number; name: string }[];
		clients: { id: string; name: string }[];
	} = $props();

	let holiday = $state(false);
	let maxSessions = $state<number | null>(null);
	$effect(() => {
		holiday = day.holiday;
		maxSessions = day.maxSessions;
	});

	let error = $state('');

	async function run(action: string, fields: Record<string, string | string[]>) {
		error = '';
		const result = await postSlotAction(action, fields);
		if (!result.ok) {
			error = result.message;
		}
	}

	function addSlot() {
		const slot = nextSlot(day.slots);
		run('addSlot', {
			weekday: String(weekday),
			startTime: slot.startTime,
			endTime: slot.endTime,
			modality: slot.modality
		});
	}

	function saveDay() {
		const fields: Record<string, string> = { weekday: String(weekday), maxSessions: '' };
		if (maxSessions !== null) {
			fields.maxSessions = String(maxSessions);
		}
		if (holiday) {
			fields.holiday = 'on';
		}
		run('saveWeekDay', fields);
	}

	// replaces the open slots on the target days; their reserved slots stay
	function copyTo(target: string) {
		const targets: string[] = [];
		if (target === 'all') {
			for (let other = 0; other < 7; other++) {
				targets.push(String(other));
			}
		} else if (target === 'weekdays') {
			for (let other = 1; other <= 5; other++) {
				targets.push(String(other));
			}
		} else {
			targets.push(target);
		}
		run('copyDay', { fromWeekday: String(weekday), targets });
	}

	// open slots may overlap; whichever is booked first hides the other on that date
	const hasOverlap = $derived.by(() => {
		for (let i = 0; i < day.slots.length; i++) {
			for (let j = i + 1; j < day.slots.length; j++) {
				const a = day.slots[i];
				const b = day.slots[j];
				if (a.startTime < b.endTime && b.startTime < a.endTime) {
					return true;
				}
			}
		}
		return false;
	});
</script>

<div class="day-header">
	<h3 class="day-name">{dayName}</h3>
	<HolidayToggle bind:holiday {dayName} onchange={saveDay} />
</div>

<div class="day-scroll">
	{#if day.holiday}
		<p class="note">
			Holiday — clients can’t book any {dayName}. The slots below are kept for when you switch it
			back. Dates you’ve edited on the calendar still use their own slots.
		</p>
	{/if}

	<div class="day-body" class:on-holiday={day.holiday}>
		{#each day.slots as slot (slot.id)}
			<WeeklySlotRow {slot} {weekday} {clients} />
		{/each}
		{#if day.slots.length === 0}
			<div class="empty">No slots — clients can’t book this day.</div>
		{/if}
		<button type="button" class="add-btn" onclick={addSlot}>+ Add slot</button>

		{#if hasOverlap}
			<p class="note">Some slots overlap. Once one is booked, the other is hidden on that date.</p>
		{/if}

		{#if day.slots.length > 0}
			<div class="day-tools">
				<MaxSessionsInput bind:value={maxSessions} onchange={saveDay} />
				<select
					class="copy-select"
					aria-label="Copy {dayName} to other days"
					value=""
					onchange={(event) => {
						copyTo(event.currentTarget.value);
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
			</div>
		{/if}
	</div>

	{#if error}
		<div class="form-error">{error}</div>
	{/if}
</div>

<style>
	/* the day and its holiday toggle stay put while the slots scroll under them */
	.day-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 18px;
	}

	.day-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0 18px 18px;
	}

	.day-name {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.note {
		margin: 0;
		padding: 8px 12px;
		border: 2px dashed var(--outline);
		border-radius: var(--radius-sm);
		background: var(--warning-bg);
		font-size: 13px;
		color: var(--text-secondary);
	}

	.day-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* still editable, just visibly not in use */
	.day-body.on-holiday {
		opacity: 0.55;
	}

	.empty {
		font-size: 13px;
		font-style: italic;
		color: var(--text-muted);
	}

	.add-btn {
		align-self: flex-start;
		padding: 5px 12px;
		border-radius: var(--radius-pill);
		border: 2px dashed var(--outline);
		background: var(--surface-card);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		text-transform: uppercase;
		cursor: pointer;
	}

	.add-btn:hover {
		background: var(--coral-100);
	}

	.day-tools {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 4px;
	}

	.copy-select {
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		text-transform: uppercase;
		padding: 5px 10px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--surface-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.form-error {
		color: var(--danger);
		font-size: 13px;
	}

	@media (max-width: 620px) {
		.day-header {
			padding: 12px 16px;
		}

		.day-scroll {
			padding: 0 16px 16px;
		}
	}
</style>
