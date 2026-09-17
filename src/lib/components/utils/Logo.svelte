<script lang="ts">
	import { STAR_VIEWBOX, STAR_PATH, SPARKLE_PATH } from '$lib/brand/star.js';

	let { size = 26, inverse = false }: { size?: number; inverse?: boolean } = $props();
</script>

<a href="/" class="logo" class:inverse style="font-size: {size}px">
	<svg class="mark" viewBox={STAR_VIEWBOX} aria-hidden="true">
		<path class="star" d={STAR_PATH} />
		<path class="sparkle" d={SPARKLE_PATH} />
	</svg>
	Lumno
</a>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: var(--ls-tight);
		color: var(--text-primary);
		text-decoration: none;
	}

	.logo.inverse {
		color: var(--text-inverse);
	}

	.mark {
		width: 1em;
		height: 1em;
		flex-shrink: 0;
	}

	.star {
		fill: var(--accent-primary);
	}

	.sparkle {
		fill: var(--accent-pop);
	}
</style>
