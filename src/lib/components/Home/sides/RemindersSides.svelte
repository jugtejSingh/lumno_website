<script lang="ts">
	import type { Face } from './face';

	let { face }: { face: Face } = $props();

	const sent = [
		{ what: 'Session tomorrow', who: 'Priya', channel: 'WhatsApp', tone: 'sage' },
		{ what: 'Payment due', who: 'Maria', channel: 'WhatsApp', tone: 'sage' },
		{ what: 'Session tomorrow', who: 'Dev', channel: 'Email', tone: 'plum' },
		{ what: 'Time to book again?', who: 'Sana', channel: 'Email', tone: 'plum' }
	];
</script>

{#if face === 'you'}
	<div class="title">Sent for you this week</div>
	<div class="rows">
		{#each sent as reminder (reminder.what + reminder.who)}
			<div class="row">
				<span>
					{reminder.what}
					<span class="muted">→ {reminder.who}</span>
				</span>
				<span class="chip chip-{reminder.tone}">{reminder.channel}</span>
			</div>
		{/each}
	</div>
	<p class="caption">
		A day before every session, when a payment's owed, and when a client hasn't booked in a while.
		Switch each one on or off in settings.
	</p>
{:else}
	<div class="chat">
		<div class="chat-head">💬 WhatsApp</div>
		<div class="bubble">
			Hi Priya, just a reminder of your session tomorrow, Thursday 24 October at 4:00 pm (India
			Standard Time).
			<span class="stamp">4:02 pm ✓✓</span>
		</div>
	</div>
	<p class="caption">
		It arrives on WhatsApp (or email if there's no number), in your client's own timezone. You never
		type it.
	</p>
{/if}

<style>
	.chat {
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	.chat-head {
		font-weight: 700;
		background: var(--sage-300);
		border-bottom: 2px solid var(--outline);
		padding: 10px 16px;
	}

	.bubble {
		margin: 18px 16px 22px;
		max-width: 360px;
		background: var(--surface-card);
		border: 2px solid var(--outline);
		border-radius: var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-xs);
		padding: 12px 14px;
		font-size: 15px;
		line-height: var(--lh-relaxed);
	}

	.stamp {
		display: block;
		text-align: right;
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 4px;
	}
</style>
