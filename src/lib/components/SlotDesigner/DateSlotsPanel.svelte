<script lang="ts">
	import { enhance } from '$lib/enhance';
	import Button from '$lib/components/utils/Button.svelte';
	import DaySlotsEditor from './DaySlotsEditor.svelte';
	import MaxSessionsInput from './MaxSessionsInput.svelte';
	import type { DesignedDay, WeeklyDay } from '$lib/types/slots';
	import type { SubmitFunction } from '@sveltejs/kit';

	// One date's bookable slots inside the calendar's day dialog. The date either follows its
	// weekday's template, or has its own override (which may have no slots = day off).
	let {
		year,
		month,
		day,
		templateDay,
		overrideDay,
		message
	}: {
		year: number;
		month: number;
		day: number;
		templateDay: WeeklyDay;
		overrideDay: DesignedDay | undefined; // undefined = follows the template
		message?: string;
	} = $props();

	let editing = $state(false);
	let draft = $state<DesignedDay>({ slots: [], maxSessions: null });

	const weekdayName = $derived(new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long' }));

	const isOff = $derived(overrideDay !== undefined && overrideDay.slots.length === 0);

	const effectiveDay = $derived.by(() => {
		if (overrideDay !== undefined) {
			return overrideDay;
		}
		// a holiday weekday keeps its slots but offers none
		if (templateDay.holiday) {
			return { slots: [], maxSessions: templateDay.maxSessions };
		}
		return templateDay;
	});

	const modalityLabels: Record<string, string> = {
		online: 'Online',
		in_person: 'In person',
		hybrid: 'Client picks'
	};

	function formatTime(time: string): string {
		const [hour, minute] = time.split(':').map(Number);
		return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	// on a holiday weekday, start from the weekday's usual slots so opening one date is quick
	function startEditing() {
		if (overrideDay === undefined) {
			draft = { slots: $state.snapshot(templateDay.slots), maxSessions: templateDay.maxSessions };
		} else {
			draft = $state.snapshot(overrideDay);
		}
		editing = true;
	}

	// shared by every form here: close the editor once the save lands
	const onSaved: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				editing = false;
			}
			await update();
		};
	};
</script>

<section class="date-slots">
	<div class="header">
		<span class="title">Bookable slots</span>
		<span class="source">
			{#if overrideDay === undefined && templateDay.holiday}
				{weekdayName}s are a holiday
			{:else if overrideDay === undefined}
				from your weekly {weekdayName}
			{:else if overrideDay.slots.length === 0}
				day off
			{:else}
				custom for this date
			{/if}
		</span>
	</div>

	{#if editing}
		<form class="edit-form" method="POST" action="?/saveDateOverride" use:enhance={onSaved}>
			<input type="hidden" name="year" value={year} />
			<input type="hidden" name="month" value={month} />
			<input type="hidden" name="day" value={day} />
			<input type="hidden" name="slots" value={JSON.stringify(draft.slots)} />
			<input type="hidden" name="maxSessions" value={draft.maxSessions ?? ''} />
			<DaySlotsEditor bind:slots={draft.slots} />
			{#if draft.slots.length > 0}
				<MaxSessionsInput bind:value={draft.maxSessions} />
			{/if}
			{#if message}
				<div class="form-error">{message}</div>
			{/if}
			<div class="actions">
				<Button type="button" variant="secondary" size="sm" onclick={() => (editing = false)}>Cancel</Button>
				<Button type="submit" variant="primary" size="sm">Save for this date</Button>
			</div>
		</form>
	{:else}
		{#if effectiveDay.slots.length === 0}
			<div class="empty">No slots — clients can’t book this day.</div>
		{:else}
			<ul class="chips">
				{#each effectiveDay.slots as slot (slot.startTime)}
					<li class="chip" data-modality={slot.modality}>
						{formatTime(slot.startTime)} – {formatTime(slot.endTime)}
						<span class="chip-type">{modalityLabels[slot.modality]}</span>
					</li>
				{/each}
			</ul>
			{#if effectiveDay.maxSessions !== null}
				<div class="cap">Max {effectiveDay.maxSessions} sessions this day</div>
			{/if}
		{/if}

		<div class="actions">
			<Button variant="secondary" size="sm" onclick={startEditing}>Edit this date</Button>
			{#if isOff}
				<form method="POST" action="?/clearDateOverride" use:enhance={onSaved}>
					<input type="hidden" name="year" value={year} />
					<input type="hidden" name="month" value={month} />
					<input type="hidden" name="day" value={day} />
					<Button type="submit" variant="secondary" size="sm">Turn this day on</Button>
				</form>
			{:else}
				<form method="POST" action="?/saveDateOverride" use:enhance={onSaved}>
					<input type="hidden" name="year" value={year} />
					<input type="hidden" name="month" value={month} />
					<input type="hidden" name="day" value={day} />
					<input type="hidden" name="slots" value="[]" />
					<Button type="submit" variant="secondary" size="sm">Turn this day off</Button>
				</form>
			{/if}
		</div>
	{/if}
</section>

<style>
	.date-slots {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 12px;
		border-top: 2px dashed var(--border-subtle);
	}

	.header {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.title {
		font-weight: 800;
		color: var(--text-primary);
	}

	.source {
		font-size: 12px;
		color: var(--text-muted);
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	@media (max-width: 620px) {
		.chips {
			flex-wrap: nowrap;
			overflow-x: auto;
			padding-bottom: 2px;
		}

		.chip {
			flex-shrink: 0;
		}
	}

	.chip {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 3px 9px;
		border: 1.5px solid var(--outline);
		border-radius: var(--radius-sm);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.chip[data-modality='online'] {
		background: var(--citrus-400);
	}

	.chip[data-modality='in_person'] {
		background: var(--plum-400);
	}

	.chip[data-modality='hybrid'] {
		background: var(--coral-100);
	}

	.chip-type {
		font-size: 11px;
		font-weight: 600;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.cap {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.empty {
		font-size: 13px;
		color: var(--text-muted);
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}
</style>
