<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'success' | 'warning' | 'danger' | 'citrus';

	let { tone, children }: { tone: Tone; children: Snippet } = $props();
</script>

<div class="badge badge-{tone}">{@render children()}</div>

<style>
	.badge {
		border-radius: var(--radius-pill);
		padding: 3px 10px;
		font-size: 12px;
		font-weight: 700;
		display: inline-block;
	}

	.badge-success {
		background: var(--success-bg);
		color: var(--success);
	}

	.badge-warning {
		background: var(--warning-bg);
		color: var(--warning);
	}

	.badge-danger {
		background: var(--danger-bg);
		color: var(--danger);
	}

	.badge-citrus {
		background: var(--citrus-300);
		color: var(--citrus-600);
	}
</style>