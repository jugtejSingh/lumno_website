<script lang="ts">
	const stats = [
		{ label: 'Sessions this week', value: '14', tone: 'plum' },
		{ label: 'Notes overdue', value: '2', tone: 'citrus' },
		{ label: 'Outstanding', value: '₹2,400', tone: 'sage' }
	];
</script>

<div class="vis-title">Good morning</div>
<div class="vis-stats">
	{#each stats as stat (stat.label)}
		<div class="vis-stat stat-{stat.tone}">
			<span class="muted">{stat.label}</span>
			<strong>{stat.value}</strong>
		</div>
	{/each}
</div>
<div class="vis-rows">
	<div class="vis-row"><span>10:00 · Priya</span><span class="muted">Google Meet</span></div>
	<div class="vis-row"><span>2:00 · Arjun</span><span class="muted">Google Meet</span></div>
</div>
