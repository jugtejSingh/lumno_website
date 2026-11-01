<script lang="ts">
	import FeatureCopy from './FeatureCopy.svelte';
	import FeatureVisual from './FeatureVisual.svelte';
	import type { Feature } from '$lib/types/home';

	let { feature }: { feature: Feature } = $props();
</script>

<article class="card">
	<FeatureCopy {feature} />
	<FeatureVisual {feature} />
</article>

<style>
	.card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: clamp(20px, 3vw, 36px);
		align-items: center;
		height: 100%;
		box-sizing: border-box;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: clamp(20px, 3vw, 32px);
	}

	@media (max-width: 720px) {
		.card {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
