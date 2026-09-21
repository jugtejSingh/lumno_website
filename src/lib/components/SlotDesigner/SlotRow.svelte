<script lang="ts">
	import TimeInput from '$lib/components/utils/TimeInput.svelte';
	import type { DesignedSlot } from '$lib/types/slots';

	let {
		slot = $bindable(),
		onremove
	}: {
		slot: DesignedSlot;
		onremove: () => void;
	} = $props();

	const modalityOptions = [
		{ value: 'online', label: 'Online' },
		{ value: 'in_person', label: 'In person' },
		{ value: 'hybrid', label: 'Client picks' }
	];
</script>

<div class="slot-row" data-modality={slot.modality}>
	<TimeInput label="From" bind:value={slot.startTime} />
	<TimeInput label="To" bind:value={slot.endTime} />
	<label class="field">
		<span class="field-label">Type</span>
		<select class="field-input" bind:value={slot.modality}>
			{#each modalityOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<button type="button" class="remove-btn" onclick={onremove} aria-label="Remove slot">&times;</button>
</div>

<style>
	.slot-row {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 10px;
		padding: 10px 12px;
		border: 2px solid var(--border-subtle);
		border-left-width: 6px;
		border-radius: var(--radius-sm);
		background: var(--surface-card);
	}

	/* left edge carries the same colours as the calendar's session chips */
	.slot-row[data-modality='online'] {
		border-left-color: var(--citrus-400);
	}

	.slot-row[data-modality='in_person'] {
		border-left-color: var(--plum-400);
	}

	.slot-row[data-modality='hybrid'] {
		border-left-color: var(--coral-100);
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

	.remove-btn {
		margin-left: auto;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		border: 2px solid var(--border-subtle);
		background: var(--surface-card);
		color: var(--text-muted);
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
	}

	.remove-btn:hover {
		color: var(--danger, #b3261e);
	}
</style>
