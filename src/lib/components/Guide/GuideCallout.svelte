<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="callout">
	<div class="callout-title">{title}</div>
	<div class="callout-body">{@render children()}</div>
</div>

<style>
	.callout {
		margin: 12px 0;
		padding: 10px 14px;
		border-radius: var(--radius-md, 8px);
		background: var(--citrus-300);
		border: 2px dashed var(--citrus-600);
	}

	.callout-title {
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 2px;
	}

	.callout-body :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
