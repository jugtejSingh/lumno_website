<script lang="ts">
	import Button from '../utils/Button.svelte';
	import FreeReceipt from './FreeReceipt.svelte';
</script>

<section id="pricing" class="pricing">
	<div class="panel">
		<div class="copy">
			<h2 class="display">Want to check it out?</h2>
			<p class="lede">
				Don't worry, you don't have to pay. Lumno is free to start, with no card and no catch.
			</p>
			<div class="action">
				<Button href="/login?tab=register" variant="primary" size="lg"
					>Start now, free forever</Button
				>
			</div>
			<p class="plans-link">
				Need more clients or AI help? <a href="/pricing">See plans →</a>
			</p>
		</div>
		<div class="visual">
			<FreeReceipt />
		</div>
	</div>
</section>

<style>
	.pricing {
		padding: clamp(40px, 6vw, 64px) max(clamp(16px, 5vw, 48px), calc((100% - 1100px) / 2));
		/* full-width band, like the week and testimonials sections */
		background: var(--sage-300);
		border-top: 2px solid var(--outline);
	}

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
		align-items: center;
		gap: clamp(24px, 5vw, 64px);
	}

	.display {
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		font-weight: 600;
		font-size: clamp(32px, 5.5vw, 52px);
		line-height: var(--lh-tight);
		text-wrap: balance;
	}

	.lede {
		font-size: 18px;
		color: var(--text-primary);
		line-height: var(--lh-relaxed);
		margin: 16px 0 0;
		max-width: 44ch;
	}

	.action {
		margin-top: 32px;
	}

	.plans-link {
		margin: 18px 0 0;
		font-size: 15px;
		color: var(--text-primary);
	}

	.plans-link a {
		color: var(--text-link);
		font-weight: 700;
		text-decoration: none;
	}

	.plans-link a:hover {
		text-decoration: underline var(--plum-500);
		text-underline-offset: 5px;
	}

	.visual {
		display: flex;
		justify-content: center;
	}

	@media (max-width: 820px) {
		.panel {
			grid-template-columns: minmax(0, 1fr);
			text-align: center;
		}

		.lede {
			margin-left: auto;
			margin-right: auto;
		}
	}
</style>
