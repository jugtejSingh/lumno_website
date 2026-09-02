<script lang="ts">
	type Accent = 'plum' | 'coral' | 'citrus' | 'sage';

	let {
		label,
		value,
		accent = 'plum',
		delta
	}: { label: string; value: string; accent?: Accent; delta?: string } = $props();
</script>

<div class="stat-card stat-{accent}">
	<div class="stat-label">{label}</div>
	<div class="stat-value">{value}</div>
	{#if delta}
		<div class="stat-delta">{delta}</div>
	{/if}
</div>

<style>
	.stat-card {
		flex: 1;
		border-radius: var(--radius-md);
		padding: 14px 16px;
		border: 1px solid var(--border-subtle);
	}

	.stat-plum {
		background: var(--plum-300);
	}

	.stat-coral {
		background: var(--coral-300);
	}

	.stat-citrus {
		background: var(--citrus-300);
	}

	.stat-sage {
		background: var(--sage-300);
	}

	.stat-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.stat-value {
		font-family: var(--font-display);
		font-size: 28px;
		color: var(--text-primary);
	}

	.stat-delta {
		font-size: 12px;
		color: var(--text-muted);
	}
</style>