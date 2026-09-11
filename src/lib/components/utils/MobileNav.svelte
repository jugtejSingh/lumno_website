<script lang="ts">
	import type { Snippet } from 'svelte';
	import Logo from './Logo.svelte';

	let { children }: { children: Snippet } = $props();

	let menu = $state<HTMLDialogElement>();
</script>

<button class="burger" aria-label="Open menu" onclick={() => menu?.showModal()}>
	<span></span><span></span><span></span>
</button>

<dialog
	bind:this={menu}
	class="drawer"
	onclick={(e) => {
		if (e.target === menu) {
			menu.close();
		}
	}}
>
	<!-- any click on a link/button inside bubbles here and dismisses the drawer -->
	<div
		class="drawer-inner"
		onclick={() => menu?.close()}
		role="presentation"
	>
		<div class="drawer-head">
			<Logo size={22} />
			<button class="drawer-close" aria-label="Close menu" onclick={() => menu?.close()}>&times;</button>
		</div>
		<nav class="drawer-links">
			{@render children()}
		</nav>
		<p class="drawer-foot">Run your practice, calmly.</p>
	</div>
</dialog>

<style>
	.burger {
		display: none;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		width: 32px;
		height: 32px;
		padding: 7px;
		border: none;
		background: transparent;
		cursor: pointer;
	}

	.burger span {
		display: block;
		height: 2px;
		width: 100%;
		border-radius: 2px;
		background: var(--text-primary);
		transition: width 0.15s var(--ease-out, ease);
	}

	/* flair: middle bar a touch shorter */
	.burger span:nth-child(2) {
		width: 70%;
		align-self: flex-end;
	}

	.burger:hover span:nth-child(2) {
		width: 100%;
	}

	/* phones + small tablets: the burger replaces the full nav */
	@media (max-width: 820px) {
		.burger {
			display: flex;
		}
	}

	/* floating panel, hugged to the top-right — no full-height dead column */
	.drawer {
		position: fixed;
		inset: 10px 10px auto auto;
		height: auto;
		max-height: calc(100dvh - 20px);
		overflow-y: auto;
		width: min(224px, 72vw);
		max-width: calc(100vw - 20px);
		padding: 0;
		border: 1px solid var(--border-subtle);
		border-top: 3px solid var(--sage-500);
		border-radius: var(--radius-lg);
		background: var(--surface-card);
		box-shadow: var(--shadow-lg);
		translate: 0 0;
		animation: drawer-in 0.2s var(--ease-out, ease);
	}

	@keyframes drawer-in {
		from {
			translate: 110% 0;
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.drawer {
			animation: none;
		}
	}

	.drawer::backdrop {
		background: rgba(0, 0, 0, 0.35);
	}

	.drawer-inner {
		display: flex;
		flex-direction: column;
		padding: 8px;
	}

	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2px 4px 8px;
		margin-bottom: 6px;
		border-bottom: 1px solid var(--border-subtle);
	}

	.drawer-close {
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		font-size: 22px;
		line-height: 1;
		color: var(--text-muted);
		cursor: pointer;
	}

	.drawer-links {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.drawer-foot {
		margin: 8px 4px 2px;
		padding-top: 8px;
		border-top: 1px solid var(--border-subtle);
		font-family: var(--font-display);
		font-style: italic;
		font-size: 12px;
		color: var(--text-muted);
	}

	.drawer-links :global(a),
	.drawer-links :global(button) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 9px 10px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-secondary);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.13s var(--ease-out, ease),
			color 0.13s var(--ease-out, ease);
	}

	/* chevron fills the empty right side and reads as "tap me" */
	.drawer-links :global(a)::after {
		content: '›';
		font-size: 15px;
		color: var(--text-muted);
	}

	.drawer-links :global(a:hover),
	.drawer-links :global(button:hover) {
		background: var(--sage-300);
		color: var(--text-primary);
	}

	.drawer-links :global(a:hover)::after {
		color: var(--text-primary);
	}

	.drawer-links :global(form) {
		margin: 0;
	}
</style>
