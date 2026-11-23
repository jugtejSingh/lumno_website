<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		title,
		onclose,
		// any CSS width; the default suits a normal form
		width = 'clamp(300px, 42vw, 560px)',
		// no body padding, for content that lays out its own edges
		flush = false,
		children
	}: {
		open: boolean;
		title?: string;
		onclose: () => void;
		width?: string;
		flush?: boolean;
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
		<div
			class="dialog"
			class:flush
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			style="--dialog-width: {width}"
		>
			<div class="dialog-header">
				<div class="dialog-title">{title}</div>
				<button type="button" class="dialog-close" onclick={onclose} aria-label="Close"
					>&times;</button
				>
			</div>
			<div class="dialog-body" class:flush>
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
		padding: 16px;
		box-sizing: border-box;
		z-index: 100;
	}

	.dialog {
		background: var(--surface-card);
		border: 1px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 0;
		max-height: 90vh;
		/* dvh so the browser's own chrome on a phone can't push the dialog off-screen */
		max-height: 90dvh;
		/* width comes from the prop; the overlay's padding is the gutter */
		width: var(--dialog-width);
		max-width: 100%;
		overflow-y: auto;
	}

	/* flush: title bar on top, the body fills the rest and its content decides what scrolls */
	.dialog.flush {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* on a phone there's no room to be picky: every dialog fills the gutter */
	@media (max-width: 520px) {
		.dialog {
			width: 100%;
		}

		.dialog-body {
			padding: 16px;
		}
	}

	/* plain header row: title on the left, close on the right */
	.dialog-header {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 12px 14px 20px;
		background-color: var(--surface-card);
		border-bottom: 1px solid var(--outline);
	}

	.dialog-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.dialog-close {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		font-size: 20px;
		font-weight: 500;
		line-height: 1;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
	}

	.dialog-close:hover {
		background: var(--surface-app);
		color: var(--text-primary);
	}

	.dialog-body.flush {
		padding: 0;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* the only padding any dialog gets */
	.dialog-body {
		padding: 20px;
		/* a long email or URL wraps instead of scrolling the dialog sideways */
		overflow-wrap: anywhere;
	}
</style>
