<script lang="ts">
	// a short who-gets-it list shared by the privacy pictures
	let { rows }: { rows: { who: string; detail: string; allowed: boolean }[] } = $props();
</script>

<dl class="rows">
	{#each rows as row (row.who)}
		<div class="row">
			<dt>
				{#if row.allowed}
					<span class="mark mark-yes" aria-label="Yes">✓</span>
				{:else}
					<span class="mark mark-no" aria-label="No">✕</span>
				{/if}
				{row.who}
			</dt>
			<dd>{row.detail}</dd>
		</div>
	{/each}
</dl>

<style>
	.rows {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		font-size: 14px;
	}

	dt {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
		color: var(--text-primary);
	}

	dd {
		margin: 0;
		text-align: right;
		color: var(--text-primary);
	}

	.mark {
		display: grid;
		place-items: center;
		flex: none;
		width: 22px;
		height: 22px;
		border: 2px solid var(--outline);
		border-radius: 50%;
		font-size: 11px;
		font-weight: 700;
	}

	.mark-yes {
		background: var(--sage-300);
	}

	.mark-no {
		background: var(--surface-card);
	}
</style>
