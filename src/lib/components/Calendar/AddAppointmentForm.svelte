<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$lib/enhance';
	import Button from '$lib/components/utils/Button.svelte';
	import TimeInput from '$lib/components/utils/TimeInput.svelte';

	let {
		year,
		month,
		day,
		clients,
		message,
		onCancel,
		onSuccess
	}: {
		year: number;
		month: number;
		day: number;
		clients: { id: string; name: string }[];
		message?: string;
		onCancel: () => void;
		onSuccess: () => void;
	} = $props();

	let useCustomName = $state(false);
	// form draft: deliberately seeded from the initial prop value only
	let clientId = $state(untrack(() => clients[0]?.id ?? ''));
	let customName = $state('');
	let rate = $state('');
	let startTime = $state('09:00');
	let endTime = $state('10:00');
	let modality = $state('online');
	let notes = $state('');
	// the server's message describes the last submit; once the user edits anything it's stale
	let editedSinceSubmit = $state(false);

	// both are zero-padded "HH:MM", so string order is time order
	const timesValid = $derived(endTime > startTime);

	const modalityOptions = [
		{ value: 'online', label: 'Online' },
		{ value: 'in_person', label: 'In Person' }
	];
</script>

<form
	class="appt-form"
	method="POST"
	action="?/addAppointment"
	oninput={() => (editedSinceSubmit = true)}
	use:enhance={() => {
		editedSinceSubmit = false;
		return async ({ result, update }) => {
			if (result.type === 'success') onSuccess();
			await update();
		};
	}}
>
	<input type="hidden" name="year" value={year} />
	<input type="hidden" name="month" value={month} />
	<input type="hidden" name="day" value={day} />
	<div class="client-toggle">
		<button
			type="button"
			class="toggle-btn"
			class:active={!useCustomName}
			onclick={() => (useCustomName = false)}
		>
			Existing client
		</button>
		<button
			type="button"
			class="toggle-btn"
			class:active={useCustomName}
			onclick={() => (useCustomName = true)}
		>
			Custom name
		</button>
	</div>
	{#if useCustomName}
		<label class="field">
			<span class="field-label">Name</span>
			<input class="field-input" type="text" name="customName" bind:value={customName} />
		</label>
		<label class="field">
			<span class="field-label">Rate (optional)</span>
			<input class="field-input" type="number" min="0" name="rate" bind:value={rate} />
		</label>
	{:else}
		<label class="field">
			<span class="field-label">Client</span>
			<select class="field-input" name="clientId" bind:value={clientId}>
				{#each clients as c (c.id)}
					<option value={c.id}>{c.name}</option>
				{/each}
			</select>
		</label>
	{/if}
	<div class="hours-row">
		<TimeInput label="Start" name="startTime" bind:value={startTime} />
		<TimeInput label="End" name="endTime" bind:value={endTime} />
	</div>
	{#if !timesValid}
		<div class="form-error">End time must be after start time</div>
	{/if}
	<label class="field">
		<span class="field-label">Modality</span>
		<select class="field-input" name="modality" bind:value={modality}>
			{#each modalityOptions as m (m.value)}
				<option value={m.value}>{m.label}</option>
			{/each}
		</select>
	</label>
	<label class="field">
		<span class="field-label">Notes</span>
		<textarea class="field-input" name="notes" rows="3" bind:value={notes}></textarea>
	</label>
	{#if message && !editedSinceSubmit}
		<div class="form-error">{message}</div>
	{/if}
	<div class="appt-form-actions">
		<Button type="button" variant="secondary" onclick={onCancel}>Cancel</Button>
		<Button type="submit" variant="primary" disabled={!timesValid}>Add appointment</Button>
	</div>
</form>

<style>
	.appt-form {
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
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.hours-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	/* side by side when there's room, one full-width picker per line on a phone */
	.hours-row > :global(*) {
		flex: 1 1 180px;
		min-width: 0;
	}

	/* iOS Safari zooms the page on focus for anything under 16px */
	@media (max-width: 620px) {
		.field-input {
			font-size: 16px;
		}
	}

	.client-toggle {
		display: flex;
		gap: 6px;
	}

	.toggle-btn {
		flex: 1;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		border: 2px solid var(--border-subtle);
		box-shadow: var(--shadow-xs);
		background: var(--surface-card);
		color: var(--text-secondary);
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.toggle-btn.active {
		background: var(--accent-primary);
		box-shadow: var(--shadow-xs);
		color: var(--text-on-accent);
	}

	.appt-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}
</style>
