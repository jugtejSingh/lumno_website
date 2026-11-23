<script lang="ts">
	import FeatureIcon from './FeatureIcon.svelte';
	import type { Feature } from '$lib/types/home';

	let { feature }: { feature: Feature } = $props();
</script>

<li class="tile span-{feature.span} accent-{feature.accent}">
	<FeatureIcon icon={feature.icon} accent={feature.accent} />
	<div class="copy">
		<h3 class="name">{feature.name}</h3>
		<p class="line">{feature.line}</p>
	</div>
</li>

<style>
	.accent-plum {
		--accent: var(--plum-300);
	}

	.accent-coral {
		--accent: var(--coral-300);
	}

	.accent-sage {
		--accent: var(--sage-300);
	}

	.accent-citrus {
		--accent: var(--citrus-300);
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px;
		background: var(--surface-card);
		border: 1px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}

	.span-1 {
		grid-column: span 1;
	}

	/* the big tile: half a row and only lightly tinted, so it leads the row without swallowing it */
	.span-2 {
		grid-column: span 2;
		background: color-mix(in srgb, var(--accent) 35%, var(--surface-card));
	}

	.name {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 600;
		line-height: 1.25;
		color: var(--text-primary);
		margin: 0;
	}

	.line {
		font-size: 14px;
		line-height: var(--lh-relaxed);
		color: var(--text-secondary);
		margin: 4px 0 0;
	}

	.span-2 .name {
		font-size: 21px;
	}

	.span-2 .line {
		font-size: 15px;
		max-width: 44ch;
	}

	/* phones: half-width tiles, so tighten everything to keep the text readable */
	@media (max-width: 640px) {
		.tile {
			gap: 10px;
			padding: 14px;
		}

		.tile :global(.icon) {
			width: 38px;
			height: 38px;
		}

		.tile :global(.icon svg) {
			width: 20px;
			height: 20px;
		}

		.name {
			font-size: 15px;
		}

		.line {
			font-size: 13px;
		}

		.span-2 .name {
			font-size: 18px;
		}

		.span-2 .line {
			font-size: 14px;
		}
	}
</style>
