<script lang="ts">
	import { marked } from 'marked';
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import StatCard from '$lib/components/utils/StatCard.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import PortalMonthGrid from '$lib/components/Calendar/PortalMonthGrid.svelte';
	import BookSlotDialog from '$lib/components/Calendar/BookSlotDialog.svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let bookDay = $state<number | null>(null);
	let rescheduleId = $state<string | null>(null);

	const bookSlots = $derived(bookDay !== null ? (data.slotsByDay[bookDay] ?? []) : []);

	function closeBookDialog() {
		bookDay = null;
		rescheduleId = null;
	}

	const monthLabel = $derived(
		new Date(data.year, data.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	);

	function gotoMonth(nextYear: number, nextMonth: number) {
		goto(`?year=${nextYear}&month=${nextMonth}`, { keepFocus: true });
	}

	function prevMonth() {
		gotoMonth(data.month === 0 ? data.year - 1 : data.year, data.month === 0 ? 11 : data.month - 1);
	}

	function nextMonth() {
		gotoMonth(data.month === 11 ? data.year + 1 : data.year, data.month === 11 ? 0 : data.month + 1);
	}
</script>

<div class="portal">
	<div>
		<div class="title">Welcome back, {data.clientName}</div>
		<div class="subtitle">Your care with {data.therapistName}</div>
	</div>

	<div id="calendar" class="section">
		<div class="section-title">Your sessions</div>
		{#each data.sessions as s (s.id)}
			<Card>
				<div class="row">
					<Avatar name={data.therapistName} size={36} />
					<div class="row-info">
						<div class="row-title">{s.when}</div>
						<div class="row-sub">{s.type}</div>
						{#if s.meetLink}
							<a class="row-meet" href={s.meetLink} target="_blank" rel="noreferrer">Join Google Meet</a>
						{/if}
					</div>
					<Badge tone={s.tone}>{s.status}</Badge>
					<div class="row-actions">
						<Button variant="secondary" size="sm" onclick={() => (rescheduleId = s.id)}>Reschedule</Button>
						<form
							method="POST"
							action="?/cancelSession"
							use:enhance={() => {
								return async ({ update }) => update();
							}}
						>
							<input type="hidden" name="appointmentId" value={s.id} />
							<Button type="submit" variant="secondary" size="sm">Cancel</Button>
						</form>
					</div>
				</div>
			</Card>
		{/each}
		{#if data.sessions.length === 0}
			<div class="hint">No upcoming sessions. Book one below.</div>
		{/if}
		<div class="hint">{data.cancellationPolicy}</div>
		{#if rescheduleId}
			<div class="reschedule-banner">
				Pick a new time below for your session.
				<button type="button" class="reschedule-cancel" onclick={() => (rescheduleId = null)}>Cancel</button>
			</div>
		{/if}

		<div class="book-toolbar">
			<div class="month-label">{monthLabel}</div>
			<div class="month-arrows">
				<button class="arrow-btn" onclick={prevMonth} aria-label="Previous month">&#8249;</button>
				<button class="arrow-btn" onclick={nextMonth} aria-label="Next month">&#8250;</button>
			</div>
		</div>
		<PortalMonthGrid
			year={data.year}
			month={data.month}
			slotsByDay={data.slotsByDay}
			onDayClick={(day) => (bookDay = day)}
		/>
	</div>

	<div id="payments" class="section">
		<div class="section-title">Payments</div>
		{#if data.activePack}
			<Card>
				<div class="pack-banner">
					You're on a pack: {data.activePack.remaining} of {data.activePack.sessionCount} sessions remaining · {data.activePack.amount}
					total
				</div>
			</Card>
		{/if}
		<div class="stat-row">
			<StatCard label="Balance due" value={data.balanceDue} accent="citrus" />
			<StatCard label="Paid total" value={data.paidTotal} accent="sage" />
		</div>
		<div class="invoice-list">
			{#each data.invoices as inv (inv.id)}
				<Card>
					<div class="row">
						<div class="row-info">
							<div class="row-title">{inv.date}</div>
							<div class="row-sub">{inv.note ?? `Session with ${data.therapistName}`}</div>
						</div>
						<div class="amount">{inv.amount}</div>
						<Badge tone={inv.tone}>{inv.status}</Badge>
					</div>
				</Card>
			{/each}
			{#if data.invoices.length === 0}
				<div class="hint">Nothing to show yet.</div>
			{/if}
		</div>
	</div>

	<div id="notes" class="section notes-section">
		<div class="section-title">Notes & homework from {data.therapistName.split(' ')[0]}</div>
		{#each data.sharedNotes as n (n.date)}
			<Card>
				<div class="shared-head">
					<div class="mono-date">{n.date}</div>
					<Tag color="sage">From {data.therapistName.split(' ')[0]}</Tag>
				</div>
				<div class="note-text">{@html marked.parse(n.text)}</div>
			</Card>
		{/each}
		{#if data.sharedNotes.length === 0}
			<div class="hint">Nothing shared yet.</div>
		{/if}
	</div>
</div>

<BookSlotDialog
	day={bookDay}
	year={data.year}
	month={data.month}
	slots={bookSlots}
	message={form?.message}
	cancellationPolicy={data.cancellationPolicy}
	rescheduleAppointmentId={rescheduleId}
	onclose={closeBookDialog}
/>

<style>
	.portal {
		display: flex;
		flex-direction: column;
		gap: 48px;
		max-width: 760px;
	}

	.title {
		font-family: var(--font-display);
		font-size: 36px;
		color: var(--text-primary);
	}

	.subtitle {
		font-family: var(--font-display);
		font-style: italic;
		font-size: 18px;
		color: var(--accent-primary);
		margin-top: 2px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.notes-section {
		padding-bottom: 24px;
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.row-info {
		flex: 1;
	}

	.row-title {
		font-weight: 700;
		color: var(--text-primary);
	}

	.row-sub {
		font-size: 13px;
		color: var(--text-muted);
	}

	.row-meet {
		display: inline-block;
		font-size: 13px;
		margin-top: 4px;
		color: var(--sage-600, var(--text-primary));
	}

	.amount {
		font-family: var(--font-mono);
		font-size: 14px;
	}

	.hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	.book-toolbar {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 6px;
	}

	.month-label {
		font-family: var(--font-display);
		font-size: 20px;
		color: var(--text-primary);
	}

	.month-arrows {
		display: flex;
		gap: 6px;
	}

	.arrow-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-card);
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
	}

	.stat-row {
		display: flex;
		gap: 14px;
	}

	.invoice-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.shared-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
	}

	.mono-date {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}

	.note-text {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
	}

	.pack-banner {
		font-size: 14px;
		color: var(--text-primary);
	}

	.row-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.reschedule-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		background: var(--beige-200);
		border-radius: var(--radius-md, 8px);
		padding: 10px 14px;
	}

	.reschedule-cancel {
		border: none;
		background: none;
		color: var(--accent-primary);
		font-weight: 700;
		cursor: pointer;
		padding: 0;
	}
</style>
