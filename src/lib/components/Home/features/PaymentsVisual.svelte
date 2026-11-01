<script lang="ts">
	const ledger = [
		{ client: 'Priya', status: '✓ Paid online', tone: 'sage' },
		{ client: 'Arjun', status: '✓ Paid online', tone: 'sage' },
		{ client: 'Maria', status: 'Nudged this week', tone: 'citrus' }
	];
</script>

<div class="vis-title">Who's paid</div>
<div class="vis-rows">
	{#each ledger as entry (entry.client)}
		<div class="vis-row">
			<span>{entry.client} · ₹1,200</span>
			<span class="chip chip-{entry.tone}">{entry.status}</span>
		</div>
	{/each}
</div>
<p class="muted">Maria's next nudge can't go out for another 7 days.</p>
