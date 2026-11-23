<script lang="ts">
	import Button from '../utils/Button.svelte';
	import HeroCollapse from './HeroCollapse.svelte';

	const facts = [
		'Free for up to 10 clients',
		'0% commission on payments',
		'Set up in about two minutes'
	];
</script>

<section class="hero">
	<div class="hero-copy">
		<div class="eyebrow">For solo practitioners</div>
		<h1 class="display">
			Why use five apps<br />
			<span class="italic-accent">when you can use Lumno?</span>
		</h1>
		<p class="lede">
			Lumno handles the reminders, payments and notes, so the day ends when your last client leaves.
		</p>
		<div class="hero-actions">
			<Button href="/login?tab=register" variant="primary" size="lg">Start free</Button>
			<Button href="/pricing" variant="secondary" size="lg">See pricing</Button>
		</div>
		<ul class="facts">
			{#each facts as fact (fact)}
				<li>{fact}</li>
			{/each}
		</ul>
	</div>

	<div class="hero-side">
		<HeroCollapse />
	</div>
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: clamp(32px, 4vw, 48px);
		/* side padding matches Nav (same 1200px cap) so the hero lines up with the logo and last button */
		padding: clamp(40px, 6vw, 72px) max(clamp(16px, 5vw, 48px), calc((100% - 1200px) / 2));
	}

	.hero-copy,
	.hero-side {
		width: 100%;
		max-width: 560px;
	}

	.hero-copy {
		justify-self: start;
	}

	.hero-side {
		justify-self: end;
	}

	@media (max-width: 900px) {
		.hero {
			grid-template-columns: minmax(0, 1fr);
		}

		.hero-copy,
		.hero-side {
			justify-self: center;
		}

		.hero-copy {
			text-align: center;
		}

		.hero-copy .hero-actions,
		.hero-copy .facts {
			justify-content: center;
		}
	}

	.eyebrow {
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--coral-700);
		margin-bottom: 16px;
	}

	.display {
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		font-weight: 600;
		font-size: clamp(34px, 4vw, 52px);
		line-height: var(--lh-tight);
		letter-spacing: -0.02em;
		text-wrap: balance;
	}

	.italic-accent {
		font-style: italic;
		font-weight: 500;
		color: var(--text-link);
	}

	.lede {
		font-size: clamp(17px, 2vw, 20px);
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin: 28px 0 0;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 24px;
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		list-style: none;
		padding: 0;
		margin: 18px 0 0;
		font-size: 14px;
		color: var(--text-secondary);
	}

</style>
