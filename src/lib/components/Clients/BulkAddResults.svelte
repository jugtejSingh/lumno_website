<script lang="ts">
	import Button from '$lib/components/utils/Button.svelte';
	import type { BulkAddRowResult } from '$lib/bulkClientRows';

	let { results, ondone }: { results: BulkAddRowResult[]; ondone: () => void } = $props();

	type Counts = {
		added: number;
		inactive: number;
		skipped: number;
		notAdded: number;
	};

	const counts = $derived.by(() => {
		const tally: Counts = { added: 0, inactive: 0, skipped: 0, notAdded: 0 };
		for (const row of results) {
			if (row.outcome === 'added') {
				tally.added += 1;
			} else if (row.outcome === 'added_inactive') {
				tally.inactive += 1;
			} else if (row.outcome === 'not_added_limit') {
				tally.notAdded += 1;
			} else {
				tally.skipped += 1;
			}
		}
		return tally;
	});

	// saved, but the invite email didn't go out — the therapist shares these by hand
	const unsent = $derived.by(() => {
		const rows: BulkAddRowResult[] = [];
		for (const row of results) {
			if (row.inviteUrl) {
				rows.push(row);
			}
		}
		return rows;
	});

	const notAddedRows = $derived.by(() => {
		const rows: BulkAddRowResult[] = [];
		for (const row of results) {
			if (row.outcome === 'not_added_limit') {
				rows.push(row);
			}
		}
		return rows;
	});
</script>

<div class="results">
	<ul class="summary">
		<li><strong>{counts.added}</strong> added and invited</li>
		{#if counts.inactive > 0}
			<li>
				<strong>{counts.inactive}</strong> added as inactive and invited — they can join their portal
				but can't book until you upgrade or free up space
			</li>
		{/if}
		{#if counts.skipped > 0}
			<li><strong>{counts.skipped}</strong> skipped (already a client, listed twice, or details missing)</li>
		{/if}
		{#if counts.notAdded > 0}
			<li><strong>{counts.notAdded}</strong> not added — your plan's limit was reached</li>
		{/if}
	</ul>

	{#if notAddedRows.length > 0}
		<div class="block">
			<div class="block-title">Not added</div>
			{#each notAddedRows as row (row.email)}
				<div class="line">{row.name} · {row.email}</div>
			{/each}
		</div>
	{/if}

	{#if unsent.length > 0}
		<div class="block warn">
			<div class="block-title">These invite emails couldn't be sent — share the link directly</div>
			{#each unsent as row (row.email)}
				<div class="line">{row.name}: <code>{row.inviteUrl}</code></div>
			{/each}
		</div>
	{/if}

	<Button variant="primary" onclick={ondone}>Done</Button>
</div>

<style>
	.results {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.summary {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		color: var(--text-primary);
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.warn {
		padding: 10px 12px;
		background: var(--citrus-300);
		border: 2px dashed var(--citrus-600);
		border-radius: var(--radius-md, 8px);
		word-break: break-all;
	}

	.block-title {
		font-weight: 700;
		color: var(--text-primary);
	}
</style>
