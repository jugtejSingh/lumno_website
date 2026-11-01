<script lang="ts">
	const times = ['Mon 10:00', 'Tue 11:00', 'Thu 12:00', 'Thu 4:00', 'Fri 3:00'];
	const picked = 'Thu 4:00';
</script>

<div class="vis-title">Pick a time that suits you</div>
<div class="vis-chips">
	{#each times as time (time)}
		{#if time === picked}
			<span class="chip chip-sage">✓ {time}</span>
		{:else}
			<span class="chip">{time}</span>
		{/if}
	{/each}
</div>
<div class="vis-rows">
	<div class="vis-row">
		<span>Thu, 4:00 pm · Priya</span>
		<span class="chip chip-plum">Booked</span>
	</div>
	<div class="vis-row">
		<span class="muted">Google Meet link</span>
		<span>Added for you</span>
	</div>
</div>
