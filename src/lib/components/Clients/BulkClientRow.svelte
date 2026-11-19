<script lang="ts">
	import { BULK_FLAG_LABELS, type BulkRowFlag } from '$lib/bulkClientRows';

	// One extracted client in the review list. Editing a field re-runs the flags in the
	// parent (flags is derived there), so fixing a typo clears its warning straight away.
	let {
		name = $bindable(''),
		email = $bindable(''),
		rate = $bindable(0),
		flags,
		onremove
	}: {
		name: string;
		email: string;
		rate: number;
		flags: BulkRowFlag[];
		onremove: () => void;
	} = $props();
</script>

<div class="row" class:flagged={flags.length > 0}>
	<input class="cell" aria-label="Name" placeholder="Full name" bind:value={name} />
	<input class="cell" aria-label="Email" placeholder="Email" type="email" bind:value={email} />
	<input
		class="cell rate"
		aria-label="Price per session"
		placeholder="Price"
		type="number"
		min="0"
		step="1"
		bind:value={rate}
	/>
	<button type="button" class="remove" aria-label={`Remove ${name || email}`} onclick={onremove}>
		&times;
	</button>
	{#if flags.length > 0}
		<div class="flags">
			{#each flags as flag (flag)}
				<span class="flag">{BULK_FLAG_LABELS[flag]}</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr 90px auto;
		gap: 6px;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px solid var(--border-subtle);
	}

	.cell {
		min-width: 0;
		font: inherit;
		font-size: 13px;
		padding: 6px 8px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-primary);
	}

	.flagged .cell {
		border-color: var(--citrus-600);
	}

	.remove {
		border: none;
		background: none;
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
		color: var(--text-muted);
		padding: 0 4px;
	}

	.flags {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.flag {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr auto;
		}

		.row .cell:nth-child(2),
		.row .cell.rate {
			grid-column: 1;
		}
	}
</style>
