<script lang="ts">
	type Kind = '30d' | 'month' | '365d' | 'year';

	let {
		options,
		period
	}: {
		options: { kind: Kind; value: string; label: string }[];
		period: { kind: Kind; label: string; prev?: string; next?: string };
	} = $props();

	const hasArrows = $derived(period.kind === 'month' || period.kind === 'year');
</script>

<!-- ponytail: plain links, so switching period resets the column pagers; add param-merging if that annoys -->
<div class="period-switch">
	<nav class="period-options" aria-label="Period">
		{#each options as option (option.kind)}
			<a
				class="period-option"
				class:active={option.kind === period.kind}
				href="?period={option.value}"
				aria-current={option.kind === period.kind ? 'page' : undefined}
			>
				{option.label}
			</a>
		{/each}
	</nav>

	{#if hasArrows}
		<div class="period-nav">
			<a class="arrow" href="?period={period.prev}" aria-label="Previous">‹</a>
			<span class="period-label">{period.label}</span>
			{#if period.next}
				<a class="arrow" href="?period={period.next}" aria-label="Next">›</a>
			{:else}
				<span class="arrow disabled" aria-hidden="true">›</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.period-switch {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.period-options {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 4px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
	}

	.period-option {
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.period-option.active {
		background: var(--plum-300);
		color: var(--text-primary);
	}

	.period-nav {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.period-label {
		font-weight: 700;
		color: var(--text-primary);
		min-width: 120px;
		text-align: center;
	}

	.arrow {
		font-size: 20px;
		line-height: 1;
		padding: 2px 8px;
		color: var(--text-primary);
		text-decoration: none;
	}

	.arrow.disabled {
		color: var(--text-muted);
		opacity: 0.4;
	}
</style>
