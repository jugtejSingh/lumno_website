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
		login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3'
	};
</script>

<Card href={feature.href} interactive>
	<div class="feature-icon icon-{feature.accent}">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
			<path d={paths[feature.icon]} />
		</svg>
	</div>
	<div class="feature-title">{feature.title}</div>
	<div class="feature-desc">{feature.desc}</div>
	<div class="feature-cta">{feature.cta} &#8594;</div>
</Card>

<style>
	.feature-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.feature-icon svg {
		width: 22px;
		height: 22px;
	}

	.icon-plum {
		background: var(--plum-300);
		color: var(--plum-700);
	}

	.icon-coral {
		background: var(--coral-300);
		color: var(--coral-600);
	}

	.icon-sage {
		background: var(--sage-300);
		color: var(--sage-600);
	}

	.icon-citrus {
		background: var(--citrus-300);
		color: var(--citrus-600);
	}

	.feature-title {
		font-weight: 700;
		font-size: 17px;
		margin: 14px 0 6px;
		color: var(--text-primary);
	}

	.feature-desc {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin-bottom: 14px;
	}

	.feature-cta {
		font-size: 13px;
		font-weight: 700;
		color: var(--accent-primary);
	}
</style>
