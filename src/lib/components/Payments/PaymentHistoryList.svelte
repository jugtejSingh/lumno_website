<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$lib/enhance';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Pager from '$lib/components/utils/Pager.svelte';
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
	let listEl = $state<HTMLDivElement>();

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
	let lastClientId = untrack(() => clientId);
	$effect(() => {
		if (clientId !== lastClientId) {
			lastClientId = clientId;
			page = 1;
		}
		load();
	});

	function formatDate(value: string) {
		return new Date(value).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// lets a parent-owned mutation (e.g. the "+ Add charge" form in ClientPaymentsDialog,
	// which lives outside this component) trigger a re-fetch via bind:this
	export function refresh() {
		load();
	}

	// the pager lives at the bottom of the scroll box, so bring the new page in from its top row
	function gotoPage(target: number) {
		page = target;
		if (listEl) {
			listEl.scrollTop = 0;
		}
	}
</script>

{#snippet rowHead(p: ClientPaymentHistoryRow)}
	<span class="row-date">{formatDate(p.appointmentStartAt ?? p.createdAt)}</span>
	<span class="row-note">{p.note ?? ''}</span>
	<span class="row-amount">{formatCurrency(p.amount, currency)}</span>
	<span class="row-status">
		{#if p.status === 'unpaid'}
			<Badge tone="warning">unpaid</Badge>
		{:else}
			paid
		{/if}
		{#if p.refundDue}
			<Badge tone="warning">refund {formatCurrency(p.refundDue, currency)}</Badge>
		{/if}
	</span>
{/snippet}

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
		<div class="history-list" bind:this={listEl}>
			{#each rows as p (p.id)}
				{#if editable}
					<!-- native disclosure: the edit fields only cost height once opened, so a
					     full page of rows stays scannable -->
					<details class="row" class:is-unpaid={p.status === 'unpaid'}>
						<summary class="row-head">{@render rowHead(p)}</summary>
						<div class="row-body">
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
								<div class="row-edit-fields">
									<Input name="amount" value={String(p.amount)} />
									<Input name="note" value={p.note ?? ''} placeholder="Note" />
									<Button type="submit" variant="secondary" size="sm">Save</Button>
								</div>
							</form>
							<div class="row-actions">
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
								{#if p.refundFlagId}
									<!-- same action as the /payments banner's Dismiss, so clearing either clears both -->
									<form
										method="POST"
										action="?/dismissDoubleCharge"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
												await load();
											};
										}}
									>
										<input type="hidden" name="exceptionId" value={p.refundFlagId} />
										<Button type="submit" variant="primary" size="sm">Mark refunded</Button>
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
						</div>
					</details>
				{:else}
					<div class="row" class:is-unpaid={p.status === 'unpaid'}>
						<div class="row-head row-head-static">{@render rowHead(p)}</div>
					</div>
				{/if}
			{/each}
			<Pager {page} {totalPages} ongoto={gotoPage} />
		</div>
	{/if}
</div>

<style>
	.history {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* ponytail: fixed height ≈ 5 closed rows, not measured — an opened row eats into it */
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 260px;
		overflow-y: auto;
		/* room for the buttons' offset shadow, which the scroll box would otherwise clip */
		padding: 0 4px 6px 0;
	}

	.history-list > :global(*) {
		flex-shrink: 0;
	}

	.row {
		border: 2px solid var(--border-subtle);
		border-left-width: 5px;
		border-left-color: var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
	}

	/* the stripe is the at-a-glance split between the unpaid block and the paid one */
	.row.is-unpaid {
		border-left-color: var(--warning);
	}

	.row-head {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 10px;
		padding: 7px 10px;
		list-style: none;
		cursor: pointer;
	}

	.row-head-static {
		cursor: default;
	}

	/* Safari still draws the default triangle without this */
	.row-head::-webkit-details-marker {
		display: none;
	}

	.row-head:hover {
		background: var(--coral-100);
	}

	.row-head-static:hover {
		background: transparent;
	}

	.row-date {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.row-note {
		font-size: 13px;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-amount {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.row-status {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.row-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		border-top: 2px dotted var(--beige-400);
	}

	.row-edit-fields {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		flex-wrap: wrap;
	}

	.row-edit-fields :global(.field:first-child) {
		width: 90px;
	}

	.row-edit-fields :global(.field:nth-child(2)) {
		flex: 1;
		min-width: 120px;
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	/* phones: date + amount on the first line, note + status under it, so nothing
	   squashes and the whole row stays one tap target */
	@media (max-width: 520px) {
		/* rows wrap to two lines here, so ≈ 5 rows needs more room */
		.history-list {
			max-height: 400px;
		}

		.row-head {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 2px 10px;
		}

		.row-amount {
			grid-column: 2;
			grid-row: 1;
		}

		.row-note {
			grid-column: 1;
			grid-row: 2;
		}

		.row-status {
			grid-column: 2;
			grid-row: 2;
		}

		.row-edit-fields :global(.field:first-child),
		.row-edit-fields :global(.field:nth-child(2)) {
			width: 100%;
			flex: 1 0 100%;
		}
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
