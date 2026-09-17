<script lang="ts">
	let { label, active = false }: { label: string; active?: boolean } = $props();
</script>

<div class="nav-item" class:active>
	{label}
</div>

<style>
	.nav-item {
		padding: 8px 12px;
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
</style>