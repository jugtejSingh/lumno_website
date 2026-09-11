<script lang="ts">
	import { enhance } from '$lib/enhance';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import { formatCurrency } from '$lib/format';
	import { toast } from 'svelte-sonner';
	import type { ClientPaymentHistoryRow, ClientPaymentTotals } from '$lib/types/payments';

	// Shared between the payments page's client-history modal (editable: mark paid / edit /
	// delete each row inline) and the read-only history view on the /clients page. Owns its
	// own fetch + pagination against GET /payments/clients/[clientId] — the caller doesn't
	// hand it rows, it hands it a clientId and this component looks after itself.
	let {
		clientId,
		currency,
		editable = false,
		ontotals
	}: {
		clientId: string;
		currency: string;
		editable?: boolean;
		ontotals?: (totals: ClientPaymentTotals) => void;
	} = $props();

	let page = $state(1);
	let rows = $state<ClientPaymentHistoryRow[]>([]);
	let total = $state(0);
	let pageSize = $state(10);
	let loading = $state(false);
	let loadFailed = $state(false);

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	async function load() {
		loading = true;
		loadFailed = false;
		try {
			const res = await fetch(`/payments/clients/${clientId}?page=${page}`);
			if (!res.ok) {
				throw new Error(`payment history request failed with ${res.status}`);
			}
			const json = await res.json();
			rows = json.rows;
			total = json.total;
			pageSize = json.pageSize;
			ontotals?.(json.totals);
		} catch {
			// a stale/foreign clientId or a dropped connection — leave the old rows
			// (if any) in place and let the therapist retry
			loadFailed = true;
			toast.error('Could not load payment history. Please try again.');
		} finally {
			loading = false;
		}
	}

	// re-fetch whenever the target client or page changes; jump back to page 1 on a client switch
	let lastClientId = clientId;
	$effect(() => {
		if (clientId !== lastClientId) {
			lastClientId = clientId;
			page = 1;
		}
		load();
	});

	function formatDate(value: string) {
		return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	// lets a parent-owned mutation (e.g. the "+ Add charge" form in ClientPaymentsDialog,
	// which lives outside this component) trigger a re-fetch via bind:this
	export function refresh() {
		load();
	}
</script>

<div class="history">
	{#if loading && rows.length === 0}
		<div class="empty">Loading…</div>
	{:else if loadFailed && rows.length === 0}
		<div class="empty">
			Couldn't load payment history.
			<Button variant="secondary" size="sm" onclick={load}>Retry</Button>
		</div>
	{:else if rows.length === 0}
		<div class="empty">No payment history yet.</div>
	{:else}
		<div class="history-list">
			{#each rows as p (p.id)}
				<div class="history-row">
					<div class="history-row-head">
						<span class="history-date">{formatDate(p.appointmentStartAt ?? p.createdAt)}</span>
						<Badge tone={p.status === 'paid' ? 'success' : 'warning'}>{p.status}</Badge>
						<span class="history-amount">{formatCurrency(p.amount, currency)}</span>
					</div>
					{#if p.note}
						<div class="history-note">{p.note}</div>
					{/if}
					{#if editable}
						<div class="history-actions">
							<form
								method="POST"
								action="?/updatePayment"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
										await load();
									};
								}}
							>
								<input type="hidden" name="paymentId" value={p.id} />
								<div class="history-edit-fields">
									<Input name="amount" value={String(p.amount)} />
									<Input name="note" value={p.note ?? ''} placeholder="Note" />
									<Button type="submit" variant="secondary" size="sm">Save</Button>
								</div>
							</form>
							{#if p.status === 'unpaid'}
								<form
									method="POST"
									action="?/markPaid"
									use:enhance={() => {
										return async ({ update }) => {
											await update();
											await load();
										};
									}}
								>
									<input type="hidden" name="paymentId" value={p.id} />
									<Button type="submit" variant="primary" size="sm">Mark paid</Button>
								</form>
							{/if}
							<form
								method="POST"
								action="?/deletePayment"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
										await load();
									};
								}}
							>
								<input type="hidden" name="paymentId" value={p.id} />
								<Button type="submit" variant="secondary" size="sm">Delete</Button>
							</form>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if totalPages > 1}
		<div class="pager">
			<Button variant="secondary" size="sm" onclick={() => { if (page > 1) page -= 1; }}>Prev</Button>
			<span class="pager-label">Page {page} of {totalPages}</span>
			<Button variant="secondary" size="sm" onclick={() => { if (page < totalPages) page += 1; }}>Next</Button>
		</div>
	{/if}
</div>

<style>
	.history {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.history-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 10px 12px;
	}

	.history-row-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.history-date {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.history-amount {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-primary);
	}

	.history-note {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.history-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 4px;
	}

	.history-edit-fields {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}

	.history-edit-fields :global(.field:first-child) {
		width: 90px;
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding-top: 4px;
	}

	.pager-label {
		font-size: 13px;
		color: var(--text-muted);
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}
</style>