<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		href,
		interactive = false,
		children
	}: {
		href?: string;
		interactive?: boolean;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a {href} class="card" class:interactive>
		{@render children()}
	</a>
{:else}
	<div class="card" class:interactive>
		{@render children()}
	</div>
{/if}

<style>
	.card {
		display: block;
		text-decoration: none;
		color: inherit;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-xs);
		padding: 24px;
	}

	.card.interactive:hover {
		box-shadow: var(--shadow-sm);
	}
</style>