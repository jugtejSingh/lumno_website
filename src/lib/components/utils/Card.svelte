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
		border: 2px solid var(--border-subtle);
		border-top-width: 12px;
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		padding: 24px;
		position: relative;
	}

	/* little old-OS window buttons sitting in the thick top frame */
	.card::before {
		content: '';
		position: absolute;
		top: -9px;
		right: 8px;
		width: 6px;
		height: 6px;
		border-radius: var(--radius-pill);
		background: var(--plum-300);
		box-shadow:
			-10px 0 0 var(--citrus-300),
			-20px 0 0 var(--sage-300);
		pointer-events: none;
	}

	.card.interactive {
		transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
	}

	.card.interactive:hover {
		text-decoration: none;
		box-shadow: var(--shadow-lg);
		background: var(--surface-canvas);
		transform: translate(-2px, -2px);
	}
</style>