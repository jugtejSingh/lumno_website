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
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$lib/enhance';
	import { toast } from 'svelte-sonner';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let bookDay = $state<number | null>(null);
	let rescheduleId = $state<string | null>(null);
	let payingId = $state<string | null>(null);

	function loadCheckoutScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (window.Razorpay) {
				resolve();
				return;
			}
			const script = document.createElement('script');
			script.src = 'https://checkout.razorpay.com/v1/checkout.js';
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('failed to load checkout script'));
			document.head.appendChild(script);
		});
	}

	const PAY_ERRORS: Record<string, string> = {
		invoice_not_found: 'That invoice could not be found.',
		not_payable: 'That invoice is no longer payable.',
		currency_unsupported: 'Online payment is not available for this practice.',
		payments_unavailable: 'Your therapist is not set up to take payments right now.',
		checkout_failed: 'Could not start checkout. Please try again.'
	};

	async function openInvoiceCheckout(checkout: {
		orderId: string;
		key: string;
		amountMinor: number;
		therapistName: string;
	}) {
		try {
			await loadCheckoutScript();
			new window.Razorpay({
				key: checkout.key,
				order_id: checkout.orderId,
				amount: checkout.amountMinor,
				currency: 'INR',
				name: checkout.therapistName,
				// The webhook flips the invoice to paid; this is just UX feedback.
				handler: () => {
					toast.success('Payment received — updating your invoice…');
					payingId = null;
					invalidateAll();
					// The webhook usually lands a few seconds after Checkout closes, so
					// the first refresh often still sees "unpaid". One more catches it.
					// ponytail: fixed delay; poll until paid if this proves flaky.
					setTimeout(() => {
						invalidateAll();
					}, 5000);
				},
				modal: { ondismiss: () => (payingId = null) }
			}).open();
		} catch {
			toast.error('Could not open checkout. Please try again.');
			payingId = null;
		}
	}

	const bookSlots = $derived(bookDay !== null ? (data.slotsByDay[bookDay] ?? []) : []);

	function closeBookDialog() {
		bookDay = null;
		rescheduleId = null;
	}

	const monthLabel = $derived(
		new Date(data.year, data.month, 1).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		})
	);

	function gotoMonth(nextYear: number, nextMonth: number) {
		goto(`?year=${nextYear}&month=${nextMonth}`, { keepFocus: true });
	}

	function prevMonth() {
		gotoMonth(data.month === 0 ? data.year - 1 : data.year, data.month === 0 ? 11 : data.month - 1);
	}

	function nextMonth() {
		gotoMonth(
			data.month === 11 ? data.year + 1 : data.year,
			data.month === 11 ? 0 : data.month + 1
		);
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
							<a class="row-meet" href={s.meetLink} target="_blank" rel="noreferrer"
								>Join Google Meet</a
							>
						{/if}
					</div>
					<Badge tone={s.tone}>{s.status}</Badge>
					<div class="row-actions">
						<Button variant="secondary" size="sm" onclick={() => (rescheduleId = s.id)}
							>Reschedule</Button
						>
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
				<button type="button" class="reschedule-cancel" onclick={() => (rescheduleId = null)}
					>Cancel</button
				>
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
						{#if inv.payable}
							<form
								method="POST"
								action="?/payInvoice"
								use:enhance={() => {
									payingId = inv.id;
									return async ({ result }) => {
										if (result.type === 'success' && result.data?.checkout) {
											await openInvoiceCheckout(
												result.data.checkout as {
													orderId: string;
													key: string;
													amountMinor: number;
													therapistName: string;
												}
											);
										} else {
											payingId = null;
											const message =
												result.type === 'failure'
													? (PAY_ERRORS[String(result.data?.message)] ??
														'Could not start checkout. Please try again.')
													: 'Could not start checkout. Please try again.';
											toast.error(message);
										}
									};
								}}
							>
								<input type="hidden" name="paymentId" value={inv.id} />
								<Button type="submit" size="sm">
									{payingId === inv.id ? 'Opening…' : 'Pay now'}
								</Button>
							</form>
						{/if}
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
		gap: clamp(32px, 6vw, 48px);
		max-width: 760px;
	}

	.title {
		font-family: var(--font-display);
		font-size: clamp(26px, 6vw, 36px);
		color: var(--text-primary);
	}

	.subtitle {
		font-family: var(--font-display);
		font-style: italic;
		font-size: clamp(16px, 4vw, 18px);
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
		flex-wrap: wrap;
		gap: 10px 14px;
	}

	.row-info {
		flex: 1;
		min-width: 140px;
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
		font-size: clamp(18px, 4vw, 20px);
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
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
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
		flex-wrap: wrap;
		gap: 6px;
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
