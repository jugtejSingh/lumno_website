<script lang="ts">
	import Button from '../utils/Button.svelte';
	import SessionPreview from './SessionPreview.svelte';
	import type { PreviewPanel } from '$lib/types/home';

	let { panels }: { panels: PreviewPanel[] } = $props();
</script>

<section class="hero">
	<div class="hero-copy">
		<div class="eyebrow">For solo therapists</div>
		<h1 class="display">Why juggle five apps <span class="italic-accent">when one will do?</span></h1>
		<p class="lede">
			Bookings, payments, cancellations and reminders — Lumno handles all of it in one place.
			Clients only see the hours you're actually free, so no one books over your lunch. And if
			someone hasn't booked in a while, we'll gently remind them for you.
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
		color: var(--text-primary);
		display: inline-block;
		background: var(--citrus-300);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-xs);
		padding: 4px 12px;
		margin-bottom: 18px;
	}

	.display {
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		font-weight: 600;
		font-size: clamp(36px, 7vw, 60px);
		line-height: var(--lh-tight);
	}

	.italic-accent {
		color: var(--text-link);
		text-decoration: underline wavy var(--plum-500);
		text-decoration-thickness: 3px;
		text-underline-offset: 8px;
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