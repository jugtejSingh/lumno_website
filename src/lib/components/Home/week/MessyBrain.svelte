<script lang="ts">
	// the jobs pile up as tilted notes; fixed offsets so every visitor sees the same mess
	let { title, items }: { title: string; items: string[] } = $props();

	type Scatter = { tilt: number; x: number; y: number; tone: string };

	const SCATTER: Scatter[] = [
		{ tilt: -4, x: -6, y: 4, tone: 'var(--citrus-300)' },
		{ tilt: 3, x: 10, y: -6, tone: 'var(--coral-300)' },
		{ tilt: 2, x: 4, y: 2, tone: 'var(--surface-card)' },
		{ tilt: -3, x: -2, y: -10, tone: 'var(--plum-300)' },
		{ tilt: -2, x: 12, y: 0, tone: 'var(--coral-300)' },
		{ tilt: 4, x: -8, y: -8, tone: 'var(--citrus-300)' },
		{ tilt: -1, x: 6, y: -4, tone: 'var(--surface-card)' }
	];

	function scatterFor(index: number): Scatter {
		return SCATTER[index % SCATTER.length];
	}
</script>

<section class="brain">
	<h3 class="brain-title">
		{title}
		<span class="count">{items.length} jobs</span>
	</h3>
	<ul class="notes">
		{#each items as item, index (item)}
			{@const scatter = scatterFor(index)}
			<li
				class="note"
				style:--tilt="{scatter.tilt}deg"
				style:--x="{scatter.x}px"
				style:--y="{scatter.y}px"
				style:--tone={scatter.tone}
			>
				{item}
			</li>
		{/each}
	</ul>
</section>

<style>
	.brain {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		height: 100%;
		padding: clamp(20px, 3vw, 28px);
		border: 2px dashed var(--outline);
		border-radius: var(--radius-lg);
	}

	.brain-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
		margin: 0 0 20px;
	}

	.count {
		font-family: inherit;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		background: var(--coral-300);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		padding: 2px 10px;
		white-space: nowrap;
	}

	.notes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px 12px;
	}

	.note {
		background: var(--tone);
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		padding: 12px 14px;
		font-size: 14px;
		line-height: 1.4;
		color: var(--text-primary);
		transform: translate(var(--x), var(--y)) rotate(var(--tilt));
	}

	/* the last note sits across both columns so the pile has no neat gap */
	.note:last-child:nth-child(odd) {
		grid-column: 1 / -1;
		justify-self: center;
		max-width: 75%;
	}

	@media (max-width: 480px) {
		.notes {
			grid-template-columns: minmax(0, 1fr);
		}

		.note:last-child:nth-child(odd) {
			max-width: none;
		}
	}
</style>
