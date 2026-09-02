<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		title,
		onclose,
		children
	}: {
		open: boolean;
		title?: string;
		onclose: () => void;
		children: Snippet;
	} = $props();
</script>

{#if open}
	<div
		class="overlay"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) onclose();
		}}
	>
		<div class="dialog" role="dialog" aria-modal="true" tabindex="-1">
			<div class="dialog-header">
				<div class="dialog-title">{title}</div>
				<button type="button" class="dialog-close" onclick={onclose} aria-label="Close">&times;</button>
			</div>
			<div class="dialog-body">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: oklch(20% 0.02 50 / 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.dialog {
		background: var(--surface-card);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 24px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
	}

	.dialog-title {
		font-family: var(--font-display);
		font-size: 22px;
		color: var(--text-primary);
	}

	.dialog-close {
		border: none;
		background: transparent;
		font-size: 20px;
		line-height: 1;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
	}
</style>
