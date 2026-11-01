<script lang="ts">
	const clients = [
		{ name: 'Priya Sharma', next: 'Thu, 4:00 pm', balance: 'Paid up', tone: 'sage' },
		{ name: 'Arjun Mehta', next: 'Every Tue, 2:00 pm', balance: 'Paid up', tone: 'sage' },
		{ name: 'Maria Dsouza', next: 'Mon, 9:30 am', balance: '₹1,200 owed', tone: 'citrus' }
	];
</script>

<div class="vis-title">Your clients</div>
<div class="vis-rows">
	{#each clients as person (person.name)}
		<div class="vis-row">
			<span>
				{person.name}
				<span class="muted">· {person.next}</span>
			</span>
			<span class="chip chip-{person.tone}">{person.balance}</span>
		</div>
	{/each}
</div>
