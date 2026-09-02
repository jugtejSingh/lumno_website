<script lang="ts">
	import type { ClientOption } from '$lib/types/payments';

	let {
		clients,
		selectedClientId,
		onselect
	}: {
		clients: ClientOption[];
		selectedClientId: string | null;
		onselect: (clientId: string) => void;
	} = $props();
</script>

<aside class="client-sidebar">
	<div class="client-sidebar-title">Clients</div>
	<div class="client-list">
		{#each clients as c (c.id)}
			<button
				type="button"
				class="client-item"
				class:active={c.id === selectedClientId}
				onclick={() => onselect(c.id)}
			>
				{c.name}
			</button>
		{/each}
		{#if clients.length === 0}
			<div class="empty">No clients yet.</div>
		{/if}
	</div>
</aside>

<style>
	.client-sidebar {
		width: 180px;
		flex-shrink: 0;
		border-right: 1px solid var(--border-subtle);
		padding-right: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.client-sidebar-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-muted);
	}

	.client-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.client-item {
		text-align: left;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		padding: 8px 10px;
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.client-item:hover {
		background: var(--surface-canvas);
	}

	.client-item.active {
		background: var(--accent-primary);
		color: var(--text-on-accent);
	}

	.empty {
		color: var(--text-muted);
		font-size: 13px;
	}
</style>