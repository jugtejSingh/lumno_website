<script lang="ts">
	import type { Snippet } from 'svelte';
	import Card from '$lib/components/utils/Card.svelte';

	let {
		id,
		number,
		title,
		intro,
		children
	}: {
		id: string;
		number: number;
		title: string;
		intro: string;
		children: Snippet;
	} = $props();
</script>

<section {id} class="guide-section">
	<Card>
		<div class="head">
			<span class="number">{String(number).padStart(2, '0')}</span>
			<h2 class="title">{title}</h2>
		</div>
		<p class="intro">{intro}</p>
		<div class="body">
			{@render children()}
		</div>
	</Card>
</section>

<style>
	.guide-section {
		/* keeps the heading clear of the top edge when jumped to from the contents */
		scroll-margin-top: 16px;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.number {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-muted);
	}

	.title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(20px, 4vw, 24px);
		color: var(--text-primary);
	}

	.intro {
		margin: 6px 0 0;
		font-size: 15px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
	}

	/* prose styles for the section content components rendered inside */
	.body {
		margin-top: 14px;
		padding-top: 14px;
		border-top: 2px dotted var(--beige-400);
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
	}

	.body :global(h3) {
		margin: 18px 0 6px;
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.body :global(h3:first-child) {
		margin-top: 0;
	}

	.body :global(p) {
		margin: 0 0 10px;
	}

	.body :global(ul),
	.body :global(ol) {
		margin: 0 0 10px;
		padding-left: 20px;
	}

	.body :global(li) {
		margin-bottom: 4px;
	}

	.body :global(a) {
		color: var(--text-primary);
		font-weight: 600;
	}

	.body :global(strong) {
		color: var(--text-primary);
	}
</style>
