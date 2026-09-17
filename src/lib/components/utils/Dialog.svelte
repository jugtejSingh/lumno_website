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
		background: rgb(53 25 14 / 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.dialog {
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 0;
		max-height: 90vh;
		max-width: calc(100vw - 32px);
		overflow-y: auto;
	}

	/* old-OS window title bar */
	.dialog-header {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 12px 10px 18px;
		background-color: var(--coral-400);
		background-image: repeating-linear-gradient(
			180deg,
			transparent 0 5px,
			rgb(255 253 248 / 0.22) 5px 7px
		);
		border-bottom: 2px solid var(--outline);
	}

	.dialog-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.dialog-close {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border: 2px solid var(--outline);
		border-radius: var(--radius-xs);
		background: var(--plum-300);
		box-shadow: var(--shadow-xs);
		font-size: 18px;
		font-weight: 700;
		line-height: 1;
		color: var(--text-primary);
		cursor: pointer;
		padding: 0;
	}

	.dialog-close:hover {
		background: var(--plum-400);
	}

	.dialog-close:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}

	.dialog-body {
		padding: 22px 24px 24px;
	}
</style>
