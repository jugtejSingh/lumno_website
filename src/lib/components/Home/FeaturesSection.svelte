<script lang="ts">
	import { onMount } from 'svelte';
	import FeatureCard from './FeatureCard.svelte';
	import type { Feature } from '$lib/types/home';

	let { features }: { features: Feature[] } = $props();

	const SECONDS_PER_FEATURE = 6;

	let index = $state(0);
	let elapsed = 0;
	let hovered = $state(false);
	let focused = $state(false);
	// once someone picks a tab themselves, autoplay stops for good
	let picked = $state(false);

	let tabList: HTMLDivElement | undefined = $state();
	let tabs: HTMLButtonElement[] = $state([]);

	function show(next: number) {
		const count = features.length;
		index = ((next % count) + count) % count;
		elapsed = 0;
	}

	function pick(next: number) {
		picked = true;
		show(next);
	}

	// only the active tab is in the tab order; arrow keys move between the rest
	function tabIndexFor(i: number): number {
		if (i === index) {
			return 0;
		}
		return -1;
	}

	function onTabKeydown(event: KeyboardEvent) {
		let next = index;
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			next = index + 1;
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			next = index - 1;
		} else if (event.key === 'Home') {
			next = 0;
		} else if (event.key === 'End') {
			next = features.length - 1;
		} else {
			return;
		}
		event.preventDefault();
		pick(next);
		tabs[index]?.focus();
	}

	// on phones the tabs are a sideways strip; keep the active one in view without scrolling the page
	$effect(() => {
		const tab = tabs[index];
		if (!tabList || !tab) {
			return;
		}
		if (tabList.scrollWidth <= tabList.clientWidth) {
			return;
		}
		const left = tab.offsetLeft - (tabList.clientWidth - tab.offsetWidth) / 2;
		tabList.scrollTo({ left, behavior: 'smooth' });
	});

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		const timer = setInterval(() => {
			if (picked || hovered || focused || document.hidden) {
				return;
			}
			elapsed = elapsed + 1;
			if (elapsed >= SECONDS_PER_FEATURE) {
				show(index + 1);
			}
		}, 1000);
		return () => {
			clearInterval(timer);
		};
	});
</script>

<section id="features" class="features">
	<div class="features-heading">
		<h2 class="display">Your whole practice, one login</h2>
		<p class="lede">Calendar, notes, payments and clients, all in one place.</p>
	</div>

	<div
		class="layout"
		role="presentation"
		onmouseenter={() => (hovered = true)}
		onmouseleave={() => (hovered = false)}
		onfocusin={() => (focused = true)}
		onfocusout={() => (focused = false)}
	>
		<div class="tab-list" role="tablist" aria-label="Features" bind:this={tabList}>
			{#each features as feature, i (feature.title)}
				<button
					bind:this={tabs[i]}
					type="button"
					role="tab"
					id="feature-tab-{i}"
					class="tab accent-{feature.accent}"
					aria-selected={i === index}
					aria-controls="feature-panel-{i}"
					tabindex={tabIndexFor(i)}
					onclick={() => pick(i)}
					onkeydown={onTabKeydown}
				>
					<span class="dot" aria-hidden="true"></span>
					{feature.tab}
				</button>
			{/each}
		</div>

		<!-- every panel sits in the same grid cell so the box keeps the tallest one's height and never jumps -->
		<div class="panels">
			{#each features as feature, i (feature.title)}
				<div
					role="tabpanel"
					id="feature-panel-{i}"
					class="panel"
					class:active={i === index}
					aria-labelledby="feature-tab-{i}"
					inert={i !== index}
				>
					<FeatureCard {feature} />
				</div>
			{/each}
		</div>
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

	.layout {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}

	.tab-list {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 10px;
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		text-align: left;
		color: var(--text-secondary);
		background: transparent;
		border: 2px solid transparent;
		border-radius: var(--radius-md);
		padding: 10px 14px;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background var(--duration-fast) var(--ease-standard),
			color var(--duration-fast) var(--ease-standard);
	}

	.tab:hover {
		color: var(--text-primary);
		background: var(--surface-sunken);
	}

	.tab[aria-selected='true'] {
		color: var(--text-primary);
		background: var(--surface-card);
		border-color: var(--outline);
		box-shadow: var(--shadow-sm);
	}

	.dot {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		border-radius: 50%;
		border: 2px solid var(--outline);
		background: var(--accent);
	}

	.accent-plum {
		--accent: var(--plum-300);
	}

	.accent-coral {
		--accent: var(--coral-300);
	}

	.accent-sage {
		--accent: var(--sage-300);
	}

	.accent-citrus {
		--accent: var(--citrus-300);
	}

	.panels {
		display: grid;
		/* room for the card's hard shadow */
		padding: 0 6px 6px 0;
	}

	.panel {
		grid-area: 1 / 1;
		visibility: hidden;
		opacity: 0;
		transition:
			opacity var(--duration-base) var(--ease-out),
			visibility 0s linear var(--duration-base);
	}

	.panel.active {
		visibility: visible;
		opacity: 1;
		transition: opacity var(--duration-base) var(--ease-out);
	}

	@media (max-width: 820px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
			gap: 16px;
		}

		.tab-list {
			flex-direction: row;
			overflow-x: auto;
			scrollbar-width: none;
			/* lets the pills bleed to the screen edge while staying swipeable */
			margin-inline: calc(-1 * clamp(16px, 5vw, 48px));
			padding: 4px clamp(16px, 5vw, 48px) 8px;
		}

		.tab-list::-webkit-scrollbar {
			display: none;
		}

		.tab {
			border-radius: var(--radius-pill);
			padding: 8px 14px;
			font-size: 14px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel,
		.panel.active,
		.tab {
			transition: none;
		}
	}
</style>
