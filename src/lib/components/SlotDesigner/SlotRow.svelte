<script lang="ts">
	import type { Snippet } from 'svelte';
	import TimeInput from '$lib/components/utils/TimeInput.svelte';
	import type { DesignedSlot } from '$lib/types/slots';

	// children: extra controls before the remove button (the weekly row's save and reserve)
	let {
		slot = $bindable(),
		onremove,
		children
	}: {
		slot: DesignedSlot;
		onremove: () => void;
		children?: Snippet;
	} = $props();

	const modalityOptions = [
		{ value: 'online', label: 'Online' },
		{ value: 'in_person', label: 'In person' },
		{ value: 'hybrid', label: 'Client picks' }
	];
</script>

<!-- one line: from → to, type chip, remove. Labels stay for screen readers only. -->
<div class="slot-row">
	<div class="time from" role="group" aria-label="From">
		<span class="when-label" aria-hidden="true">From</span>
		<TimeInput bind:value={slot.startTime} />
	</div>
	<span class="arrow" aria-hidden="true">→</span>
	<div class="time to" role="group" aria-label="To">
		<span class="when-label" aria-hidden="true">To</span>
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
	<div class="extras">
		{@render children?.()}
	</div>
	<button type="button" class="remove-btn" onclick={onremove} aria-label="Remove slot">&times;</button>
</div>

<style>
	.slot-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.time {
		display: flex;
		align-items: center;
	}

	.when-label {
		display: none;
	}

	/* a phone gets a small card: From + remove, To + type, then the client chip */
	@media (max-width: 520px) {
		.slot-row {
			gap: 8px;
			padding: 10px;
			border: 2px solid var(--border-subtle);
			border-radius: var(--radius-md);
			background: var(--surface-sunken);
		}

		.arrow {
			display: none;
		}

		.when-label {
			display: inline-block;
			width: 38px;
			font-family: var(--font-mono);
			font-size: 10.5px;
			font-weight: 700;
			text-transform: uppercase;
			color: var(--text-muted);
		}

		.from {
			order: 1;
			flex: 1;
		}

		.remove-btn {
			order: 2;
			min-width: 36px;
			min-height: 36px;
		}

		.to {
			order: 3;
		}

		.type-chip {
			order: 4;
		}

		.slot-row .extras {
			order: 5;
			margin-left: 0;
		}

		.extras :global(.reserve) {
			justify-content: flex-start;
		}
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

	/* the client chip / save button sits at the end of the line, before the remove button */
	.extras {
		margin-left: auto;
		min-width: 0;
	}

	.remove-btn {
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
