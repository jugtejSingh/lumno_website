<script lang="ts">
	import type { Accent, FeatureIconName } from '$lib/types/home';

	let { icon, accent }: { icon: FeatureIconName; accent: Accent } = $props();

	// ponytail: one inline path per icon instead of an icon library — only 6 of them, ever.
	const paths: Record<FeatureIconName, string> = {
		dashboard: 'M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h8v8H3v-8Zm10-3h8v11h-8V10Z',
		calendar: 'M4 5h16v16H4V5Zm0 4h16M8 3v4M16 3v4',
		payments: 'M3 7h18v12H3V7Zm0 4h18M7 15h4',
		notes: 'M6 3h9l5 5v13H6V3Zm9 0v5h5M9 12h8M9 16h8',
		clients:
			'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1a3.5 3.5 0 1 0 0-7M2 21c0-4 3-6.5 6-6.5s6 2.5 6 6.5m2-6c2.6 0 6 2 6 6',
		reminders: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0'
	};
</script>

<div class="icon accent-{accent}" aria-hidden="true">
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d={paths[icon]} />
	</svg>
</div>

<style>
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

	.icon {
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent);
		color: var(--text-primary);
		border: 1px solid var(--outline);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-xs);
	}

	.icon svg {
		width: 24px;
		height: 24px;
	}
</style>
