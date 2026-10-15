<script lang="ts">
	import type { Snippet } from 'svelte';

	let { bad = false, children }: { bad?: boolean; children: Snippet } = $props();
</script>

<div class="banner" class:banner-bad={bad}>
	{@render children()}
</div>

<style>
	.banner {
		margin-bottom: 16px;
		padding: 10px 14px;
		border-radius: var(--radius-md, 8px);
		font-size: 13px;
		font-weight: 600;
		background: var(--citrus-300);
		border: 2px dashed var(--citrus-600);
		color: var(--text-secondary);
	}

	.banner-bad {
		background: var(--danger-bg);
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
