<script lang="ts">
	import FeatureCard from './FeatureCard.svelte';
	import type { Feature } from '$lib/types/home';

	let { features }: { features: Feature[] } = $props();
</script>

<section id="features" class="features">
	<div class="features-heading">
		<h2 class="display">Everything your practice runs on</h2>
		<p class="lede">Every page in the app. Nothing to configure before it's useful.</p>
	</div>
	<div class="features-grid">
		{#each features as feature (feature.title)}
			<FeatureCard {feature} />
		{/each}
	</div>
</section>

<style>
	.features {
		padding: 20px clamp(16px, 5vw, 64px) clamp(56px, 9vw, 100px);
		max-width: 1200px;
		margin: 0 auto;
	}

	.features-heading {
		text-align: center;
		margin-bottom: 48px;
	}

	.display {
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		font-size: clamp(26px, 5vw, 36px);
	}

	.lede {
		font-size: 16px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin: 10px 0 0;
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		gap: 20px;
	}
</style>