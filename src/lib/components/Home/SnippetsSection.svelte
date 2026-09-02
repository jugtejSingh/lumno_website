<script lang="ts">
	import SnippetRow from './SnippetRow.svelte';
	import Card from '../utils/Card.svelte';
	import StatCard from '../utils/StatCard.svelte';
	import Avatar from '../utils/Avatar.svelte';
	import Badge from '../utils/Badge.svelte';
	import Tag from '../utils/Tag.svelte';
</script>

<section class="snippets">
	<SnippetRow
		eyebrow="Dashboard"
		title="Your day, at a glance"
		desc="Today's sessions, notes due, and what needs a look — the moment you log in."
		cta="Open dashboard"
		href="/dashboard"
	>
		<div class="mockup">
			<div class="stat-row">
				<StatCard label="Sessions this week" value="12" accent="plum" />
				<StatCard label="New clients" value="3" accent="coral" />
			</div>
			<Card>
				<div class="session-row">
					<Avatar name="Maria Chen" />
					<div class="session-info">
						<div class="session-name">Maria Chen</div>
						<div class="session-time">Today · 2:00 PM</div>
					</div>
					<Badge tone="success">confirmed</Badge>
				</div>
			</Card>
		</div>
	</SnippetRow>

	<SnippetRow
		eyebrow="Calendar"
		title="A full month, always in view"
		desc="A large calendar keeps every booking visible, with reminders so you know who's in the chair and when."
		cta="Open calendar"
		href="/calendar"
		reverse
	>
		<div class="mockup">
			<div class="cal-grid">
				{#each Array(28) as _, i (i)}
					<div class="cal-cell" class:busy={[3, 9, 14, 20].includes(i)} class:pending={i === 9}>
						{i + 1}
					</div>
				{/each}
			</div>
			<div class="cal-legend">
				<Tag color="plum">confirmed</Tag>
				<Tag color="citrus">pending</Tag>
			</div>
		</div>
	</SnippetRow>

	<SnippetRow
		eyebrow="Payments"
		title="Know what's left, at a glance"
		desc="Configure rates and payout methods once, then see revenue and outstanding balances update on their own."
		cta="Open payments"
		href="/payments"
	>
		<div class="mockup">
			<StatCard label="Revenue this month" value="$3,240" accent="sage" delta="+$180 vs last month" />
			<Card>
				<div class="pay-row">
					<span>Priya Nair</span>
					<Tag color="sage">paid</Tag>
				</div>
				<div class="pay-row">
					<span>James Okoro</span>
					<Tag color="citrus">due</Tag>
				</div>
			</Card>
		</div>
	</SnippetRow>

	<SnippetRow
		eyebrow="Client notes"
		title="A real space to write"
		desc="A diary-sized page for each session, dated and kept with the client's history — not a cramped text box."
		cta="Open notes"
		href="/notes"
		reverse
	>
		<div class="mockup">
			<Card>
				<div class="note-header">
					<div class="note-title">Priya Nair — Thu, Sep 4</div>
					<Tag color="sage">dated</Tag>
				</div>
				<div class="note-line"></div>
				<div class="note-line"></div>
				<div class="note-line short"></div>
			</Card>
		</div>
	</SnippetRow>
</section>

<style>
	.snippets {
		padding: 0 48px 110px;
		max-width: 1080px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 96px;
	}

	.mockup {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.stat-row {
		display: flex;
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
		font-size: 14px;
	}

	.session-time {
		font-size: 12px;
		color: var(--text-muted);
	}

	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-xs);
		padding: 16px;
	}

	.cal-cell {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		font-size: 12px;
		color: var(--text-secondary);
		background: var(--surface-canvas);
	}

	.cal-cell.busy {
		background: var(--plum-300);
		color: var(--plum-700);
		font-weight: 700;
	}

	.cal-cell.pending {
		background: var(--citrus-300);
		color: var(--citrus-600);
	}

	.cal-legend {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.pay-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 14px;
		font-weight: 600;
		padding: 6px 0;
	}

	.pay-row + .pay-row {
		border-top: 1px solid var(--border-subtle);
	}

	.note-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14px;
	}

	.note-title {
		font-weight: 700;
		font-size: 14px;
	}

	.note-line {
		height: 10px;
		border-radius: 5px;
		background: var(--surface-sunken);
		margin-bottom: 10px;
	}

	.note-line.short {
		width: 60%;
	}
</style>
