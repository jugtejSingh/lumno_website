<script lang="ts">
	import Button from '../utils/Button.svelte';
	import Tag from '../utils/Tag.svelte';
	import type { PreviewPanel } from '$lib/types/home';

	let { panels }: { panels: PreviewPanel[] } = $props();

	let tick = $state(0);
	let notesFixed = $state(false);
	let homeworkSent = $state(false);

	$effect(() => {
		const timer = setInterval(() => {
			tick = (tick + 1) % panels.length;
		}, 9000);

		return () => {
			clearInterval(timer);
		};
	});

	function selectTab(i: number) {
		tick = i;
	}

	let currentPanel = $derived(panels[tick]);
	const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	// Auto-play the notes demo (fix up, then send) instead of waiting on a real click.
	$effect(() => {
		if (currentPanel.kind !== 'notes') return;

		notesFixed = false;
		homeworkSent = false;
		const fixTimer = setTimeout(() => {
			notesFixed = true;
		}, 900);
		const sendTimer = setTimeout(() => {
			homeworkSent = true;
		}, 3500);

		return () => {
			clearTimeout(fixTimer);
			clearTimeout(sendTimer);
		};
	});
</script>

<div class="preview-card">
	<div class="tabs">
		{#each panels as panel, i (panel.label)}
			<button type="button" class="tab" class:active={i === tick} onclick={() => selectTab(i)}>
				{panel.label}
			</button>
		{/each}
	</div>

	{#key tick}
		<div class="panel-block">
			{#if currentPanel.kind === 'booking'}
				<div class="cal-grid">
					{#each weekdayLabels as wd, i (i)}
						<div class="cal-weekday">{wd}</div>
					{/each}
					{#each currentPanel.weeks as week, wi (wi)}
						{#each week as cell, di (di)}
							<div class="cal-cell" class:today={cell.isToday} class:empty={cell.day === null}>
								{#if cell.day !== null}
									<div class="cal-daynum" class:today={cell.isToday}>{cell.day}</div>
									{#each (cell.sessions ?? []).slice(0, 2) as s (s.time + s.name)}
										<div class="cal-chip cal-chip-{s.color}">{s.name.split(' ')[0]}</div>
									{/each}
								{/if}
							</div>
						{/each}
					{/each}
				</div>
				<div class="email-toast">
					<span class="email-icon">✉️</span>
					<div class="email-body">
						<div class="email-subject">Confirmation sent to you and Maria Chen</div>
						<div class="email-meta">Today · 2:00 PM · <span class="meet-link">meet.google.com/abc-defg-hjk</span></div>
					</div>
				</div>
			{:else if currentPanel.kind === 'payments'}
				<div class="pay-header">
					<div class="pay-title">This month</div>
					<Button size="sm" variant="primary">+ Add payment</Button>
				</div>

				<div class="pay-stats">
					<div class="pay-stat">
						<div class="pay-stat-label">Collected this month</div>
						<div class="pay-stat-value">{currentPanel.collected}</div>
					</div>
					<div class="pay-stat">
						<div class="pay-stat-label">Payments left</div>
						<div class="pay-stat-value">{currentPanel.paymentsLeft}</div>
					</div>
				</div>

				<div class="pay-info">
					<div class="pay-info-row"><span class="info-dot"></span>Payments are collected automatically after each session</div>
					<div class="pay-info-row"><span class="info-dot"></span>Reminders go out automatically for anything unpaid</div>
				</div>

				<div class="agenda-title">Per-client breakdown</div>
				{#each currentPanel.breakdown as b (b.client)}
					<div class="owed-row">
						<span class="agenda-client">{b.client}</span>
						<span class="owed-amount">{b.amount}</span>
						{#if b.status === 'paid'}
							<Tag color="sage">paid</Tag>
						{:else if b.reminderSent}
							<Tag color="citrus">reminder sent</Tag>
						{:else}
							<Tag color="coral">owes</Tag>
						{/if}
					</div>
				{/each}
			{:else}
				<div class="pay-header">
					<div class="pay-title">{currentPanel.client}'s session note</div>
					{#if notesFixed}
						<Tag color="sage">active</Tag>
					{:else}
						<Tag color="beige">draft</Tag>
					{/if}
				</div>

				<p class="note-text">{notesFixed ? currentPanel.cleanedNote : currentPanel.rawNote}</p>

				<div class="notes-actions">
					<Button size="sm" variant="pop" onclick={() => (notesFixed = true)}>
						{notesFixed ? 'Fixed up ✓' : '✨ Fix up with AI'}
					</Button>
					<Button size="sm" variant="secondary" onclick={() => (homeworkSent = true)}>
						{homeworkSent ? 'Sent ✓' : 'Send notes & homework'}
					</Button>
				</div>

				{#if homeworkSent}
					<div class="homework-toast">
						<span class="email-icon">✅</span>
						Homework sent to {currentPanel.client}: "{currentPanel.homework}"
					</div>
				{/if}
			{/if}
		</div>
	{/key}
</div>

<style>
	.preview-card {
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 28px;
	}

	.tabs {
		display: flex;
		gap: 6px;
		margin-bottom: 18px;
		border-bottom: 1px solid var(--border-subtle);
	}

	.tab {
		border: none;
		background: transparent;
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		padding: 0 4px 10px;
		cursor: pointer;
		border-bottom: 2px solid transparent;
	}

	.tab.active {
		color: var(--accent-primary);
		border-bottom-color: var(--accent-primary);
	}

	.panel-block {
		height: 380px;
		overflow: hidden;
	}

	/* Booking */
	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
		margin-bottom: 4px;
	}

	.cal-weekday {
		font-size: 10px;
		font-weight: 700;
		color: var(--text-muted);
		text-align: center;
		padding-bottom: 6px;
	}

	.cal-cell {
		min-height: 52px;
		padding: 4px;
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.cal-cell.empty {
		background: transparent;
	}

	.cal-cell.today {
		background: var(--plum-300);
		box-shadow: inset 0 0 0 1px var(--plum-500);
	}

	.cal-daynum {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.cal-daynum.today {
		color: var(--plum-700);
	}

	.cal-chip {
		border-radius: 4px;
		padding: 1px 4px;
		font-size: 9px;
		font-weight: 600;
		color: var(--text-on-accent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cal-chip-plum {
		background: var(--plum-500);
	}

	.cal-chip-coral {
		background: var(--coral-500);
	}

	.cal-chip-sage {
		background: var(--sage-500);
	}

	.email-toast {
		margin-top: 14px;
		display: flex;
		align-items: flex-start;
		gap: 10px;
		background: var(--surface-canvas);
		border-radius: var(--radius-sm);
		padding: 10px 14px;
	}

	.email-icon {
		font-size: 15px;
		line-height: 1.4;
	}

	.email-subject {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.email-meta {
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	.meet-link {
		color: var(--accent-primary);
		font-weight: 600;
	}

	.agenda-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		margin-bottom: 10px;
	}

	.owed-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-top: 1px solid var(--border-subtle);
		font-size: 13px;
	}

	.agenda-client {
		color: var(--text-secondary);
		flex: 1;
	}

	/* Payments */
	.pay-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14px;
	}

	.pay-title {
		font-weight: 700;
		font-size: 14px;
		color: var(--text-primary);
	}

	.pay-stats {
		display: flex;
		gap: 10px;
		margin-bottom: 14px;
	}

	.pay-stat {
		flex: 1;
		background: var(--surface-canvas);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
	}

	.pay-stat-label {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}

	.pay-stat-value {
		font-family: var(--font-display);
		font-size: 22px;
		color: var(--text-primary);
	}

	.owed-amount {
		font-weight: 700;
		color: var(--text-primary);
	}

	.pay-info {
		margin-bottom: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pay-info-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-secondary);
	}

	.info-dot {
		flex-shrink: 0;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent-calm);
	}

	/* Notes */
	.note-text {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		background: var(--surface-canvas);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
		margin: 0 0 16px;
	}

	.notes-actions {
		display: flex;
		gap: 10px;
		margin-bottom: 4px;
	}

	.homework-toast {
		margin-top: 12px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		background: var(--surface-canvas);
		border-radius: var(--radius-sm);
		padding: 10px 14px;
	}
</style>
