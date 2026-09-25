<script lang="ts">
	import StatCard from '$lib/components/utils/StatCard.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showOverdueNotes = $state(false);
</script>

<div class="dashboard">
	<div class="greeting">
		<div class="greeting-title">Good afternoon, {data.therapistName.split(' ')[0]}</div>
		<div class="greeting-sub">You have {data.todayCount} sessions today</div>
	</div>

	<div class="stat-row">
		{#each data.stats as stat (stat.label)}
			<StatCard
				label={stat.label}
				value={stat.value}
				accent={stat.accent}
				delta={stat.delta}
				onclick={stat.label === 'Notes overdue' ? () => (showOverdueNotes = true) : undefined}
			/>
		{/each}
	</div>

	<div>
		<div class="section-title">Upcoming sessions</div>
		<div class="session-list">
			{#each data.upcoming as session (session.id)}
				<Card interactive>
					<div class="session-row">
						<Avatar name={session.name} />
						<div class="session-info">
							<div class="session-name">{session.name}</div>
							<div class="session-time">{session.next}</div>
						</div>
						<Badge tone={session.tone}>{session.status}</Badge>
						<Button href={session.notesHref} size="sm" variant="secondary">Notes</Button>
					</div>
				</Card>
			{/each}
		</div>
	</div>
</div>

<Dialog
	open={showOverdueNotes}
	title="Notes overdue this week"
	onclose={() => (showOverdueNotes = false)}
>
	{#if data.notesOverdueThisWeek.length === 0}
		<div class="overdue-empty">No overdue notes this week.</div>
	{:else}
		<div class="overdue-list">
			{#each data.notesOverdueThisWeek as session (session.id)}
				<div class="overdue-row">
					<span class="overdue-name">{session.name}</span>
					<span class="overdue-when">{session.when}</span>
				</div>
			{/each}
		</div>
	{/if}
</Dialog>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 960px;
	}

	.greeting-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(28px, 6vw, 40px);
		color: var(--text-primary);
	}

	.greeting-sub {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(18px, 4vw, 22px);
		color: var(--text-link);
		margin-top: 2px;
	}

	.stat-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
		gap: 14px;
	}

	.overdue-empty {
		color: var(--text-muted);
	}

	.overdue-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.overdue-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.overdue-name {
		font-weight: 700;
		color: var(--text-primary);
	}

	.overdue-when {
		font-size: 13px;
		color: var(--text-muted);
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		margin-bottom: 10px;
		color: var(--text-primary);
	}

	.session-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.session-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px 12px;
	}

	.session-info {
		flex: 1;
		min-width: 120px;
	}

	.session-name {
		font-weight: 700;
		color: var(--text-primary);
	}

	.session-time {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>