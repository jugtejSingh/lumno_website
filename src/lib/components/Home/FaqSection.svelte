<script lang="ts">
	// every answer here must match how the app actually works (see the in-app Guide)
	const QUESTIONS: { question: string; answer: string }[] = [
		{
			question: 'Is adding a client a lot of work?',
			answer:
				"No, and that's on purpose. Just a name and an email, no ten-column forms. Your client fills in their own details when they accept the invite."
		},
		{
			question: 'Can I keep track of the things my practice cares about?',
			answer:
				'Yes. Make up to 20 of your own fields, like "Presenting concerns" or "Medication", and they show up on every client. Set a different rate per client, and only you ever see them.'
		},
		{
			question: 'Can anyone book a session with me?',
			answer:
				"Only clients you've invited can book on their own, so nobody can fill up your calendar without you knowing. For a discovery call, turn on a temporary link in Settings and share it. It stops working after 7 days, or whenever you turn it off."
		},
		{
			question: 'How do I get paid?',
			answer:
				'Clients pay you by UPI or bank transfer, or online through your own Razorpay account. The money goes straight to you, and Lumno takes 0%.'
		},
		{
			question: 'Something missing that you need?',
			answer:
				'Tell us. Press Feedback at the bottom of any page and request a feature. We read every message.'
		}
	];
</script>

<section id="faq" class="faq">
	<div class="faq-heading">
		<h2 class="display">Questions, answered</h2>
		<p class="lede">The things practitioners usually ask before signing up.</p>
	</div>

	<div class="list">
		{#each QUESTIONS as item (item.question)}
			<details class="item">
				<summary class="question">{item.question}</summary>
				<p class="answer">{item.answer}</p>
			</details>
		{/each}
	</div>
</section>

<style>
	.faq {
		padding: clamp(40px, 6vw, 64px) max(clamp(16px, 5vw, 48px), calc((100% - 760px) / 2));
		background: var(--surface-canvas);
		border-top: 2px solid var(--outline);
		border-bottom: 2px solid var(--outline);
	}

	.faq-heading {
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

	.list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		/* room for the cards' hard shadow */
		padding: 0 6px 6px 0;
	}

	.item {
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
	}

	.question {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 16px 20px;
		font-weight: 700;
		font-size: 16px;
		color: var(--text-primary);
		cursor: pointer;
		list-style: none;
	}

	.question::-webkit-details-marker {
		display: none;
	}

	.question::after {
		content: '+';
		flex-shrink: 0;
		font-size: 22px;
		line-height: 1;
		transition: transform var(--duration-fast) var(--ease-standard);
	}

	.item[open] .question::after {
		transform: rotate(45deg);
	}

	.answer {
		margin: 0;
		padding: 0 20px 18px;
		font-size: 15px;
		line-height: var(--lh-relaxed);
		color: var(--text-secondary);
	}

	@media (prefers-reduced-motion: reduce) {
		.question::after {
			transition: none;
		}
	}
</style>
