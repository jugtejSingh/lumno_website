<script lang="ts">
	import Button from '../utils/Button.svelte';
	import SessionPreview from './SessionPreview.svelte';
	import type { PreviewPanel } from '$lib/types/home';

	let { panels }: { panels: PreviewPanel[] } = $props();
</script>

<section class="hero">
	<div class="hero-copy">
		<div class="eyebrow">For solo therapists</div>
		<h1 class="display">Run your practice, <span class="italic-accent">calmly.</span></h1>
		<p class="lede">
			Scheduling, reminders, payments, and notes — one calm place to run the parts of your
			practice that aren't the session itself.
		</p>
		<div class="hero-actions">
			<Button href="/login?tab=register" variant="primary" size="lg">Get started for free</Button>
			<Button href="/#features" variant="secondary" size="lg">See how it works</Button>
		</div>
	</div>

	<div class="hero-preview">
		<SessionPreview {panels} />
	</div>
</section>

<style>
	.hero {
		display: flex;
		align-items: center;
		gap: clamp(32px, 5vw, 56px);
		padding: clamp(48px, 9vw, 96px) clamp(16px, 5vw, 48px);
		max-width: 1280px;
		margin: 0 auto;
	}

	.hero-copy {
		flex: 1;
		min-width: 0;
	}

	.eyebrow {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--accent-primary);
		margin-bottom: 14px;
	}

	.display {
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		font-size: clamp(36px, 7vw, 60px);
		line-height: var(--lh-tight);
	}

	.italic-accent {
		font-style: italic;
		color: var(--accent-primary);
	}

	.lede {
		font-size: 18px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin: 20px 0 0;
		max-width: 480px;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 32px;
	}

	.hero-preview {
		flex-shrink: 0;
		width: 520px;
		max-width: 100%;
	}

	@media (max-width: 860px) {
		.hero {
			flex-direction: column;
			align-items: stretch;
		}

		.hero-preview {
			width: 100%;
		}
	}
</style>