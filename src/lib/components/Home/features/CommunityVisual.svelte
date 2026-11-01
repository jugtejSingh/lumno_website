<script lang="ts">
	const colleagues = [
		{ name: 'Dr. Ananya Rao', tags: ['Couples', 'Hindi'] },
		{ name: 'Kabir Singh', tags: ['Teens', 'ADHD'] }
	];
</script>

<div class="vis-title">Colleagues on Lumno</div>
<div class="vis-rows">
	{#each colleagues as colleague (colleague.name)}
		<div class="vis-row">
			<span>
				{colleague.name}
				{#each colleague.tags as tag (tag)}
					<span class="chip">{tag}</span>
				{/each}
			</span>
			<span class="chip chip-coral">Refer →</span>
		</div>
	{/each}
</div>
