<script lang="ts">
	import TimeInput from '$lib/components/utils/TimeInput.svelte';
	import SlotReserveControl from './SlotReserveControl.svelte';
	import type { DesignedSlot } from '$lib/types/slots';

	// clients is only passed for weekly-template slots: date overrides can't be reserved
	let {
		slot = $bindable(),
		clients,
		onremove
	}: {
		slot: DesignedSlot;
		clients?: { id: string; name: string }[];
		onremove: () => void;
	} = $props();

	const modalityOptions = [
		{ value: 'online', label: 'Online' },
		{ value: 'in_person', label: 'In person' },
		{ value: 'hybrid', label: 'Client picks' }
	];
</script>

<!-- one line: from → to, type chip, remove. Labels stay for screen readers only. -->
<div class="slot-row">
	<div class="time" role="group" aria-label="From">
		<TimeInput bind:value={slot.startTime} />
	</div>
	<span class="arrow" aria-hidden="true">→</span>
	<div class="time" role="group" aria-label="To">
		<TimeInput bind:value={slot.endTime} />
	</div>
	<label class="type-chip" data-modality={slot.modality}>
		<span class="sr-only">Type</span>
		<select bind:value={slot.modality}>
			{#each modalityOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	{#if clients}
		<SlotReserveControl bind:slot {clients} />
	{/if}
	<button type="button" class="remove-btn" onclick={onremove} aria-label="Remove slot">&times;</button>
</div>

<style>
	.slot-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 7px;
	}

	.time {
		display: flex;
	}

	/* TimeInput's own fields, slimmed down to fit on one line */
	.slot-row :global(.field-input) {
		padding: 5px 7px;
		font-size: 13px;
		font-weight: 700;
		border-color: var(--outline);
	}

	.slot-row :global(.minute) {
		width: 48px;
	}

	.arrow {
		color: var(--text-muted);
		font-size: 13px;
	}

	.type-chip select {
		appearance: none;
		padding: 5px 12px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-xs);
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-primary);
		cursor: pointer;
	}

	/* same colours as the calendar's session chips */
	.type-chip[data-modality='online'] select {
		background: var(--citrus-400);
	}

	.type-chip[data-modality='in_person'] select {
		background: var(--plum-300);
	}

	.type-chip[data-modality='hybrid'] select {
		background: var(--coral-100);
	}

	.type-chip select:focus-visible {
		outline: none;
		box-shadow: var(--shadow-focus);
	}

	.remove-btn {
		margin-left: auto;
		padding: 0 4px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 20px;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
	}

	.remove-btn:hover {
		color: var(--danger);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
