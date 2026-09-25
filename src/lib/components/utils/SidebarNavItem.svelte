<script lang="ts">
	type Tone = 'nav' | 'quiet' | 'danger';

	let {
		label,
		active = false,
		tone = 'nav'
	}: { label: string; active?: boolean; tone?: Tone } = $props();
</script>

<div class="nav-item tone-{tone}" class:active>
	{label}
</div>

<style>
	.nav-item {
		/* tightens on short windows so the sidebar never needs to scroll */
		padding: clamp(4px, 1vh, 8px) 12px;
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.nav-item:hover {
		background: var(--coral-100);
		border-color: var(--beige-400);
	}

	.nav-item.active {
		background: var(--coral-400);
		border-color: var(--outline);
		box-shadow: var(--shadow-xs);
		color: var(--text-primary);
	}

	/* actions, not destinations: lighter, never "active", no coral hover */
	.tone-quiet {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.tone-quiet:hover {
		background: transparent;
		border-color: var(--beige-400);
		border-style: dotted;
		color: var(--text-primary);
	}

	.tone-danger {
		font-size: 13px;
		color: var(--danger);
	}

	.tone-danger:hover {
		background: var(--danger-bg);
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
