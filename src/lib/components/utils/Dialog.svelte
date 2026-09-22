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
		border: 2px solid var(--outline);
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
