<script lang="ts">
	import Card from '../utils/Card.svelte';
	import type { Feature } from '$lib/types/home';

	let { feature }: { feature: Feature } = $props();

	// ponytail: one inline path per icon instead of an icon library — only 7 of them, ever.
	const paths: Record<Feature['icon'], string> = {
		dashboard: 'M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h8v8H3v-8Zm10-3h8v11h-8V10Z',
		calendar: 'M4 5h16v16H4V5Zm0 4h16M8 3v4M16 3v4',
		payments: 'M3 7h18v12H3V7Zm0 4h18M7 15h4',
		notes: 'M6 3h9l5 5v13H6V3Zm9 0v5h5M9 12h8M9 16h8',
		clients: 'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1a3.5 3.5 0 1 0 0-7M2 21c0-4 3-6.5 6-6.5s6 2.5 6 6.5m2-6c2.6 0 6 2 6 6',
		referrals: 'M12 2v6M12 22v-6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M16 12h6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2',
		login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
		reminders: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0'
	};
</script>

<Card href={feature.href} interactive>
	<div class="feature-card accent-{feature.accent}">
		<div class="feature-icon">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
				<path d={paths[feature.icon]} />
			</svg>
		</div>
		<div class="feature-title">{feature.title}</div>
		<div class="feature-desc">{feature.desc}</div>
		<div class="feature-cta">{feature.cta} <span class="arrow">&#8594;</span></div>
	</div>
</Card>

<style>
	.feature-card {
		position: relative;
	}

	.feature-icon {
		width: 52px;
		height: 52px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(155deg, var(--accent-300), var(--accent-300) 60%, var(--accent-400));
		color: var(--accent-700, var(--accent-600));
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent-500) 25%, transparent);
	}

	.feature-icon svg {
		width: 26px;
		height: 26px;
	}

	.accent-plum {
		--accent-300: var(--plum-300);
		--accent-400: var(--plum-400);
		--accent-500: var(--plum-500);
		--accent-600: var(--plum-600);
		--accent-700: var(--plum-700);
	}

	.accent-coral {
		--accent-300: var(--coral-300);
		--accent-400: var(--coral-400);
		--accent-500: var(--coral-500);
		--accent-600: var(--coral-600);
	}

	.accent-sage {
		--accent-300: var(--sage-300);
		--accent-400: var(--sage-400);
		--accent-500: var(--sage-500);
		--accent-600: var(--sage-600);
	}

	.accent-citrus {
		--accent-300: var(--citrus-300);
		--accent-400: var(--citrus-400);
		--accent-500: var(--citrus-500);
		--accent-600: var(--citrus-600);
	}

	.feature-title {
		font-weight: 700;
		font-size: 17px;
		margin: 18px 0 6px;
		color: var(--text-primary);
	}

	.feature-desc {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin-bottom: 16px;
	}

	.feature-cta {
		font-size: 13px;
		font-weight: 700;
		color: var(--accent-600, var(--accent-primary));
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.arrow {
		transition: transform 0.15s ease;
	}

	:global(.card.interactive:hover) .arrow {
		transform: translateX(3px);
	}
</style>
