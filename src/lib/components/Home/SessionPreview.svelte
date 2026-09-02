<script lang="ts">
	import StatCard from '../utils/StatCard.svelte';
	import Card from '../utils/Card.svelte';
	import Avatar from '../utils/Avatar.svelte';
	import Badge from '../utils/Badge.svelte';
	import Tag from '../utils/Tag.svelte';
	import type { Stat, Session } from '$lib/types/home';

	let { stats, sessions }: { stats: Stat[]; sessions: Session[] } = $props();

	let tick = $state(0);

	$effect(() => {
		const timer = setInterval(() => {
			tick = (tick + 1) % sessions.length;
		}, 4000);

		return () => {
			clearInterval(timer);
		};
	});

	let currentSession = $derived(sessions[tick]);
</script>

<div class="preview-card">
	<div class="stat-row">
		{#each stats as stat (stat.label)}
			<StatCard label={stat.label} value={stat.value} accent={stat.accent} />
		{/each}
	</div>

	{#key tick}
		<div class="session-block">
			<Card>
				<div class="session-row">
					<Avatar name={currentSession.name} />
					<div class="session-info">
						<div class="session-name">{currentSession.name}</div>
						<div class="session-time">{currentSession.time}</div>
					</div>
					<Badge tone={currentSession.tone}>{currentSession.tag}</Badge>
				</div>
			</Card>
			<div class="note-block">
				<div class="note-header">
					<div class="note-label">Note saved</div>
					<Tag color="sage">dated</Tag>
				</div>
				<div class="note-text">{currentSession.note}</div>
			</div>
		</div>
	{/key}
</div>

<style>
	.preview-card {
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 24px;
	}

	.stat-row {
		display: flex;
		gap: 10px;
		margin-bottom: 14px;
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
		font-size: 14px;
	}

	.session-time {
		font-size: 12px;
		color: var(--text-muted);
	}

	.note-block {
		margin-top: 10px;
		background: var(--surface-canvas);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
	}

	.note-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.note-label {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
	}

	.note-text {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: var(--lh-normal);
	}
</style>