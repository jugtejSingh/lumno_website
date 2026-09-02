<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '../utils/Button.svelte';

	let {
		eyebrow,
		title,
		desc,
		cta,
		href,
		reverse = false,
		children
	}: {
		eyebrow: string;
		title: string;
		desc: string;
		cta: string;
		href: string;
		reverse?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="snippet-row" class:reverse>
	<div class="snippet-media">
		{@render children()}
	</div>
	<div class="snippet-copy">
		<div class="eyebrow">{eyebrow}</div>
		<h3 class="display">{title}</h3>
		<p class="lede">{desc}</p>
		<Button {href} variant="secondary" size="md">{cta}</Button>
	</div>
</div>

<style>
	.snippet-row {
		display: flex;
		align-items: center;
		gap: 56px;
	}

	.snippet-row.reverse {
		flex-direction: row-reverse;
	}

	.snippet-media,
	.snippet-copy {
		flex: 1;
		min-width: 0;
	}

	.eyebrow {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--accent-primary);
		margin-bottom: 10px;
	}

	.display {
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0 0 14px;
		font-size: 32px;
	}

	.lede {
		font-size: 16px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin: 0 0 20px;
		max-width: 420px;
	}
</style>
