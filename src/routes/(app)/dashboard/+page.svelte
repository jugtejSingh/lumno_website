<script lang="ts">
	import StatCard from '$lib/components/utils/StatCard.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="dashboard">
	<div class="greeting">
		<div class="greeting-title">Good afternoon, {data.therapistName.split(' ')[0]}</div>
		<div class="greeting-sub">You have {data.todayCount} sessions today</div>
	</div>

	<div class="stat-row">
		{#each data.stats as stat (stat.label)}
			<StatCard label={stat.label} value={stat.value} accent={stat.accent} delta={stat.delta} />
		{/each}
	</div>

	<div>
		<div class="section-title">Upcoming sessions</div>
		<div class="session-list">
			{#each data.upcoming as session (session.name)}
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

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 960px;
	}

	.greeting-title {
		font-family: var(--font-display);
		font-size: 40px;
		color: var(--text-primary);
	}

	.greeting-sub {
		font-family: var(--font-display);
		font-style: italic;
		font-size: 22px;
		color: var(--accent-primary);
		margin-top: 2px;
	}

	.stat-row {
		display: flex;
		gap: 14px;
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
		gap: 12px;
	}

	.session-info {
		flex: 1;
		min-width: 0;
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