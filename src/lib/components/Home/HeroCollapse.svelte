<script lang="ts">
	import TwoSides from './TwoSides.svelte';

	// x/y are px offsets from the centre, scaled by --spread so phones get a tighter fan
	const tiles = [
		{ icon: '💬', label: 'WhatsApp', x: -150, y: -110, r: -14, tone: 'sage' },
		{ icon: '📊', label: 'Sheets', x: 140, y: -120, r: 10, tone: 'citrus' },
		{ icon: '📅', label: 'Calendar', x: -170, y: 60, r: 8, tone: 'coral' },
		{ icon: '📝', label: 'Docs', x: 160, y: 80, r: -9, tone: 'plum' },
		{ icon: '💸', label: 'UPI', x: 0, y: 150, r: 4, tone: 'sage' }
	];
</script>

<div class="stage">
	{#each tiles as tile, i (tile.label)}
		<div
			class="tile tile-{tile.tone}"
			style="--x: {tile.x}; --y: {tile.y}; --r: {tile.r}deg; --i: {i}"
			aria-hidden="true"
		>
			<span class="tile-icon">{tile.icon}</span>
			{tile.label}
		</div>
	{/each}

	<div class="landed">
		<TwoSides />
	</div>
</div>

<style>
	.stage {
		--spread: 1;
		position: relative;
		min-height: 460px;
		display: grid;
		place-items: center;
	}

	.tile,
	.landed {
		grid-area: 1 / 1;
	}

	.tile {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 16px;
		color: var(--text-primary);
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		padding: 14px 20px;
		transform: translate(calc(var(--x) * 1px * var(--spread)), calc(var(--y) * 1px * var(--spread)))
			rotate(var(--r));
		animation: collapse 700ms var(--ease-standard) forwards;
		animation-delay: calc(900ms + var(--i) * 90ms);
		pointer-events: none;
	}

	.tile-icon {
		font-size: 22px;
	}

	.tile-sage {
		background: var(--sage-300);
	}

	.tile-citrus {
		background: var(--citrus-300);
	}

	.tile-coral {
		background: var(--coral-300);
	}

	.tile-plum {
		background: var(--plum-300);
	}

	.landed {
		position: relative;
		z-index: 1;
		width: 100%;
		opacity: 0;
		animation: land 600ms var(--ease-out) forwards;
		animation-delay: 1.9s;
	}

	@keyframes collapse {
		to {
			transform: translate(0, 0) rotate(0) scale(0.6);
			opacity: 0;
		}
	}

	@keyframes land {
		from {
			opacity: 0;
			transform: scale(0.5);
		}
		70% {
			opacity: 1;
			transform: scale(1.04);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (max-width: 560px) {
		.stage {
			--spread: 0.55;
			min-height: 340px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tile {
			display: none;
		}

		.landed {
			animation: none;
			opacity: 1;
		}
	}
</style>
