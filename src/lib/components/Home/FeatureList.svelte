<script lang="ts">
	import FeatureTile from './FeatureTile.svelte';
	import type { Feature } from '$lib/types/home';

	let { rows }: { rows: Feature[][] } = $props();
</script>

<section id="features" class="features">
	<div class="features-heading">
		<h2 class="display">Everything Lumno does</h2>
		<p class="lede">Your whole practice, one login.</p>
	</div>

	<!-- every row is its own 4-column grid, laid out by hand in data/featureList.ts -->
	<div class="bento">
		{#each rows as row, i (i)}
			<ul class="row">
				{#each row as feature (feature.name)}
					<FeatureTile {feature} />
				{/each}
			</ul>
		{/each}
	</div>
</section>

<style>
	.features {
		padding: clamp(40px, 6vw, 64px) max(clamp(16px, 5vw, 48px), calc((100% - 1200px) / 2));
	}

	.features-heading {
		text-align: center;
		margin-bottom: 32px;
	}

	.display {
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		font-weight: 600;
		font-size: clamp(26px, 5vw, 36px);
	}

	.lede {
		font-size: 16px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin: 10px 0 0;
	}

	.bento {
		display: flex;
		flex-direction: column;
		gap: clamp(12px, 2vw, 18px);
		/* room for the tiles' hard shadow */
		padding: 0 6px 6px 0;
	}

	.row {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: clamp(12px, 2vw, 18px);
	}

	/* tablets and phones: 2 columns, big tiles go full width.
	   dense lets the small tiles either side of a big one pair up instead of leaving holes */
	@media (max-width: 900px) {
		.row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-auto-flow: dense;
		}
	}

	@media (max-width: 640px) {
		.bento,
		.row {
			gap: 10px;
		}
	}
</style>
