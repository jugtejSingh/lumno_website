<script lang="ts">
	import type { Snippet } from 'svelte';

	// the short, tidy list; `ending` is pinned to the bottom so the empty space shows
	let { title, items, ending }: { title: string; items: string[]; ending: Snippet } = $props();
</script>

<section class="brain">
	<h3 class="brain-title">
		{title}
		<span class="count">{items.length} jobs</span>
	</h3>
	<ol class="tasks">
		{#each items as item (item)}
			<li class="task">
				<span class="box" aria-hidden="true"></span>
				{item}
			</li>
		{/each}
	</ol>
	<div class="ending">{@render ending()}</div>
</section>

<style>
	.brain {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		height: 100%;
		padding: clamp(20px, 3vw, 28px);
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
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
		margin: 0 0 16px;
	}

	.count {
		font-family: inherit;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		background: var(--sage-300);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		padding: 2px 10px;
		white-space: nowrap;
	}

	.tasks {
		list-style: none;
		padding: 0;
		margin: 0 0 24px;
	}

	.task {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 0;
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
		border-bottom: 1px dashed var(--outline);
	}

	.task:last-child {
		border-bottom: none;
	}

	.box {
		flex: none;
		width: 14px;
		height: 14px;
		border: 2px solid var(--outline);
		border-radius: 4px;
		background: var(--surface-card);
	}

	.ending {
		margin-top: auto;
		padding: 16px;
		background: var(--sage-300);
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
	}
</style>
