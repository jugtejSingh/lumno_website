<script lang="ts">
	// Upcoming and past appointments for one client, already formatted server-side
	// (see listUpcomingAppointmentsForClient / listPastAppointmentsForClient).
	let {
		upcoming,
		past
	}: {
		upcoming: { id: string; when: string; modality: string | null }[];
		past: { id: string; when: string }[];
	} = $props();
</script>

<div class="sessions">
	<div class="section">
		<div class="section-title">Upcoming</div>
		{#if upcoming.length === 0}
			<div class="empty">No upcoming sessions booked.</div>
		{:else}
			<ul class="list">
				{#each upcoming as s (s.id)}
					<li class="row">
						<span class="when">{s.when}</span>
						{#if s.modality}
							<span class="modality">{s.modality === 'online' ? 'Online' : 'In person'}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="section">
		<div class="section-title">Past</div>
		{#if past.length === 0}
			<div class="empty">No past sessions yet.</div>
		{:else}
			<ul class="list">
				{#each past as s (s.id)}
					<li class="row">
						<span class="when">{s.when}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.sessions {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.section-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		font-size: 13px;
		color: var(--text-primary);
	}

	.modality {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
	}

	.empty {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
