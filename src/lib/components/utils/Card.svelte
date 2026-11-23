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
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: 24px;
		position: relative;
	}

	.card.interactive {
		transition:
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}

	@media (hover: hover) {
		.card.interactive:hover {
			text-decoration: none;
			border-color: var(--border-strong);
			box-shadow: var(--shadow-md);
		}
	}
</style>
