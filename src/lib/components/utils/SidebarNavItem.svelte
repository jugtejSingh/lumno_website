<script lang="ts">
	let { label, active = false }: { label: string; active?: boolean } = $props();
</script>

<div class="nav-item" class:active>
	{label}
</div>

<style>
	.nav-item {
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.nav-item:hover {
		background: var(--surface-canvas);
	}

	.nav-item.active {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}
</style>