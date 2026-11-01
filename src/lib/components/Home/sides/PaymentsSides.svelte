<script lang="ts">
	import type { Face } from './face';

	let { face }: { face: Face } = $props();

	const ledger = [
		{ client: 'Priya', amount: '₹1,200', paid: true, note: 'Paid online' },
		{ client: 'Arjun', amount: '₹1,200', paid: true, note: 'Paid online' },
		{ client: 'Maria', amount: '₹1,200', paid: false, note: 'Reminder sent' },
		{ client: 'Dev', amount: '₹1,200', paid: false, note: 'Due Friday' }
	];

	const invoices = [
		{ label: 'Session · 23 Oct', amount: '₹1,200', paid: false },
		{ label: 'Session · 16 Oct', amount: '₹1,200', paid: true },
		{ label: 'Session · 9 Oct', amount: '₹1,200', paid: true }
	];
</script>

{#if face === 'you'}
	<div class="title">Who's paid this week</div>
	<div class="totals">
		<div class="total">
			<span class="muted">Collected</span>
			<span class="big">₹2,400</span>
		</div>
		<div class="total">
			<span class="muted">Still owed</span>
			<span class="big">₹2,400</span>
		</div>
	</div>
	<div class="rows">
		{#each ledger as entry (entry.client)}
			<div class="row">
				<span>{entry.client} · {entry.amount}</span>
				{#if entry.paid}
					<span class="chip chip-sage">✓ {entry.note}</span>
				{:else}
					<span class="chip chip-citrus">{entry.note}</span>
				{/if}
			</div>
		{/each}
	</div>
	<p class="caption">
		Online payments mark themselves as paid, with 0% commission. Anyone who owes gets a nudge once a
		week.
	</p>
{:else}
	<div class="title">Your payments</div>
	<div class="total due">
		<span class="muted">Balance due</span>
		<span class="big">₹1,200</span>
	</div>
	<div class="rows">
		{#each invoices as invoice (invoice.label)}
			<div class="row">
				<span>{invoice.label} · {invoice.amount}</span>
				{#if invoice.paid}
					<span class="chip chip-sage">✓ Paid</span>
				{:else}
					<span class="pay">Pay now →</span>
				{/if}
			</div>
		{/each}
	</div>
	<p class="caption">
		Your client pays in a tap, or by UPI QR or bank transfer if they prefer. No chasing, no
		screenshots.
	</p>
{/if}

<style>
	.totals {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin-bottom: 14px;
	}

	.total {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-md);
		background: var(--surface-card);
		box-shadow: var(--shadow-xs);
		padding: 12px 16px;
	}

	.due {
		background: var(--citrus-300);
		margin-bottom: 14px;
	}

	.big {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 28px;
	}

	.pay {
		font-size: 13px;
		font-weight: 700;
		background: var(--accent-primary);
		color: var(--text-on-accent);
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-xs);
		padding: 4px 12px;
		white-space: nowrap;
	}
</style>
