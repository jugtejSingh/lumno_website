<script lang="ts">
	import MessyBrain from './week/MessyBrain.svelte';
	import CalmBrain from './week/CalmBrain.svelte';

	// every job on the left is something Lumno does instead; the right is all that's left
	const now = [
		'Build the calendar, block busy days, rebook clashes',
		'Chase no-shows, haggle over cancellation fees',
		'Send reminders, Meet links and holiday notices',
		"Log sessions in a tracker, chase who hasn't paid (miss one, lose ₹2,000)",
		'Make invoices by hand',
		'Write 20-minute notes, send homework that gets lost',
		'Dig through WhatsApp for client documents'
	];

	const withLumno = ['Take the session.', 'Write up brief notes.'];
</script>

<div class="lists">
	<MessyBrain title="Your brain without Lumno" items={now} />
	<CalmBrain title="Your brain with Lumno" items={withLumno}>
		{#snippet ending()}
			<strong class="done">That's it.</strong>
			<span class="rest">
				We handle everything else, so you can work on what's important: more clients and better
				sessions.
			</span>
		{/snippet}
	</CalmBrain>
</div>

<style>
	.lists {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(20px, 3vw, 40px);
		align-items: stretch;
	}

	.done {
		display: block;
		font-family: var(--font-display);
		font-size: 20px;
	}

	.rest {
		display: block;
		font-size: 14px;
		line-height: var(--lh-relaxed);
	}

	@media (max-width: 720px) {
		.lists {
			grid-template-columns: minmax(0, 1fr);
		}

		/* stacked, the right card would shrink to fit; keep some of the empty space */
		.lists > :global(:last-child) {
			min-height: 340px;
		}
	}
</style>
