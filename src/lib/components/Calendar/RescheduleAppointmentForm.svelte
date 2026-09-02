<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/utils/Button.svelte';
	import TimeInput from '$lib/components/utils/TimeInput.svelte';
	import type { CalendarSession } from '$lib/types/calendar';

	let {
		year,
		month,
		day,
		session,
		message,
		onCancel,
		onSuccess
	}: {
		year: number;
		month: number;
		day: number;
		session: CalendarSession;
		message?: string;
		onCancel: () => void;
		onSuccess: () => void;
	} = $props();

	function pad(n: number) {
		return String(n).padStart(2, '0');
	}

	let dateValue = $state(`${year}-${pad(month + 1)}-${pad(day)}`);
	let startTime = $state(session.startTime);
	let endTime = $state(session.endTime);
	let modality = $state(session.modality);

	const modalityOptions = [
		{ value: 'online', label: 'Online' },
		{ value: 'in_person', label: 'In Person' }
	];

	const targetYear = $derived(Number(dateValue.split('-')[0]));
	const targetMonth = $derived(Number(dateValue.split('-')[1]) - 1);
	const targetDay = $derived(Number(dateValue.split('-')[2]));
</script>

<form
	class="reschedule-form"
	method="POST"
	action="?/rescheduleAppointment"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') onSuccess();
			await update();
		};
	}}
>
	<input type="hidden" name="appointmentId" value={session.id} />
	<input type="hidden" name="year" value={targetYear} />
	<input type="hidden" name="month" value={targetMonth} />
	<input type="hidden" name="day" value={targetDay} />
	<label class="field">
		<span class="field-label">New date</span>
		<input class="field-input" type="date" bind:value={dateValue} />
	</label>
	<div class="hours-row">
		<TimeInput label="Start" name="startTime" bind:value={startTime} />
		<TimeInput label="End" name="endTime" bind:value={endTime} />
	</div>
	<label class="field">
		<span class="field-label">Modality</span>
		<select class="field-input" name="modality" bind:value={modality}>
			{#each modalityOptions as m (m.value)}
				<option value={m.value}>{m.label}</option>
			{/each}
		</select>
	</label>
	{#if message}
		<div class="form-error">{message}</div>
	{/if}
	<div class="reschedule-form-actions">
		<Button type="button" variant="secondary" onclick={onCancel}>Cancel</Button>
		<Button type="submit" variant="primary">Reschedule</Button>
	</div>
</form>

<style>
	.reschedule-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-top: 4px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.field-input {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.hours-row {
		display: flex;
		gap: 10px;
	}

	.reschedule-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}
</style>
