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
		border-right: 2px solid var(--border-subtle);
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
		background: var(--coral-100);
	}

	/* tint + left accent bar (inset shadow, so no layout shift) */
	.client-item.active {
		background: var(--coral-100);
		box-shadow: inset 3px 0 0 var(--accent-primary);
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		color: var(--text-primary);
		font-weight: 700;
	}

	.empty {
		color: var(--text-muted);
		font-size: 13px;
	}

	/* ponytail: stacked layout below 640px — rail becomes a horizontal strip.
	   Must stay last: media queries add no specificity, so the base .client-list/
	   .client-item rules above would otherwise win. */
	@media (max-width: 640px) {
		.client-sidebar {
			width: auto;
			border-right: none;
			border-bottom: 2px dotted var(--beige-400);
			padding-right: 0;
			padding-bottom: 10px;
		}

		.client-list {
			flex-direction: row;
			flex-wrap: nowrap;
			overflow-x: auto;
			gap: 6px;
		}

		.client-item {
			flex-shrink: 0;
			white-space: nowrap;
			border-radius: 999px;
		}

		.client-item.active {
			background: var(--accent-primary);
			box-shadow: none;
			border-radius: 999px;
			color: var(--text-on-accent);
		}
	}
</style>