<script lang="ts">
	import type { Feature } from '$lib/types/home';

	let { feature }: { feature: Feature } = $props();
</script>

<!-- the little mock screen for a feature; decorative, the text beside it says the same thing -->
<div class="visual" aria-hidden="true">
	<feature.visual />
</div>

<style>
	.visual {
		background: var(--surface-sunken);
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-size: 14px;
		color: var(--text-primary);
	}

	/* shared bits for the mock screens in ./features */
	.visual :global(.vis-title) {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 18px;
	}

	.visual :global(.vis-rows) {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.visual :global(.vis-row) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		font-weight: 600;
	}

	.visual :global(.vis-chips) {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.visual :global(.vis-steps) {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.visual :global(.vis-steps li) {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
	}

	.visual :global(.vis-note) {
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		line-height: var(--lh-relaxed);
	}

	.visual :global(.vis-note.raw) {
		background: transparent;
		border-style: dashed;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-muted);
	}

	.visual :global(.vis-stats) {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	.visual :global(.vis-stat) {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
		padding: 8px 10px;
		font-size: 12px;
	}

	.visual :global(.vis-stat strong) {
		font-family: var(--font-display);
		font-size: 20px;
	}

	.visual :global(.stat-plum) {
		background: var(--plum-300);
	}

	.visual :global(.stat-citrus) {
		background: var(--citrus-300);
	}

	.visual :global(.stat-sage) {
		background: var(--sage-300);
	}

	.visual :global(.muted) {
		color: var(--text-muted);
		font-weight: 500;
	}

	.visual :global(p.muted) {
		margin: 0;
		font-size: 13px;
	}

	.visual :global(.chip) {
		display: inline-block;
		flex-shrink: 0;
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		padding: 2px 10px;
		margin-right: 4px;
	}

	.visual :global(.chip-sage) {
		background: var(--sage-300);
	}

	.visual :global(.chip-citrus) {
		background: var(--citrus-300);
	}

	.visual :global(.chip-coral) {
		background: var(--coral-300);
	}

	.visual :global(.chip-plum) {
		background: var(--plum-300);
	}
</style>
