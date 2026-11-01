<script lang="ts">
	import FeatureIcon from './FeatureIcon.svelte';
	import type { Feature } from '$lib/types/home';

	let { feature }: { feature: Feature } = $props();
</script>

<div class="copy">
	<div class="top">
		<FeatureIcon icon={feature.icon} accent={feature.accent} />
		{#if feature.automatic}
			<span class="badge">Runs on its own</span>
		{/if}
	</div>
	<h3 class="title">{feature.title}</h3>
	<p class="desc">{feature.desc}</p>
	<ul class="points">
		{#each feature.points as point (point)}
			<li><span class="tick" aria-hidden="true">✓</span>{point}</li>
		{/each}
	</ul>
	<a class="cta" href={feature.href}>{feature.cta} →</a>
</div>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.badge {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		background: var(--sage-300);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		padding: 3px 10px;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 22px;
		line-height: var(--lh-tight);
		color: var(--text-primary);
		margin: 16px 0 8px;
	}

	.desc {
		font-size: 15px;
		line-height: var(--lh-relaxed);
		color: var(--text-secondary);
		margin: 0 0 16px;
	}

	.points {
		list-style: none;
		padding: 0;
		margin: -2px 0 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 15px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.tick {
		color: var(--sage-600);
		font-weight: 700;
		margin-right: 8px;
	}

	.cta {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-link);
		text-decoration: none;
	}

	.cta:hover {
		text-decoration: underline var(--plum-500);
		text-underline-offset: 5px;
	}
</style>
