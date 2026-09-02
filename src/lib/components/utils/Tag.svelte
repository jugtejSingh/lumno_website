<script lang="ts">
	import type { Snippet } from 'svelte';

	type Color = 'sage' | 'plum' | 'coral' | 'citrus' | 'beige';

	let {
		color = 'sage',
		onremove,
		children
	}: { color?: Color; onremove?: () => void; children: Snippet } = $props();
</script>

<div class="tag tag-{color}">
	{@render children()}
	{#if onremove}
		<button type="button" class="tag-remove" onclick={onremove} aria-label="Remove">&times;</button>
	{/if}
</div>

<style>
	.tag {
		border-radius: var(--radius-pill);
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.tag-sage {
		background: var(--sage-300);
		color: var(--sage-600);
	}

	.tag-plum {
		background: var(--plum-300);
		color: var(--plum-700);
	}

	.tag-coral {
		background: var(--coral-300);
		color: var(--coral-600);
	}

	.tag-citrus {
		background: var(--citrus-300);
		color: var(--citrus-600);
	}

	.tag-beige {
		background: var(--beige-200);
		color: var(--beige-700);
	}

	.tag-remove {
		border: none;
		background: transparent;
		cursor: pointer;
		color: inherit;
		font-size: 12px;
		line-height: 1;
		padding: 0;
	}
</style>