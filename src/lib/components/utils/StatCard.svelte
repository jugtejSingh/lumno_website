<script lang="ts">
	type Accent = 'plum' | 'coral' | 'citrus' | 'sage';

	let {
		label,
		value,
		accent = 'plum',
		delta,
		onclick
	}: { label: string; value: string; accent?: Accent; delta?: string; onclick?: () => void } =
		$props();
</script>

<div
	class="stat-card stat-{accent}"
	class:stat-clickable={!!onclick}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
	onclick={onclick}
	onkeydown={onclick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onclick()) : undefined}
>
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
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-xs);
	}

	/* ponytail: accent prop is now unused (cards are neutral); drop it from callers if the look sticks */
	.stat-label {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.stat-value {
		font-family: var(--font-display);
		font-size: 28px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-primary);
	}

	.stat-delta {
		font-size: 12px;
		color: var(--text-muted);
	}

	.stat-clickable {
		cursor: pointer;
	}
</style>