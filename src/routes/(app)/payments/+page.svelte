<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import StatCard from '$lib/components/utils/StatCard.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import AddChargeDialog from '$lib/components/Payments/AddChargeDialog.svelte';
	import PacksMakerDialog from '$lib/components/Payments/PacksMakerDialog.svelte';
	import ClientPaymentsDialog from '$lib/components/Payments/ClientPaymentsDialog.svelte';
	import ClientSidebar from '$lib/components/Payments/ClientSidebar.svelte';
	import { formatCurrency } from '$lib/format';
	import { goto } from '$app/navigation';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let openClientId = $state<string | null>(null);
	let addChargeOpen = $state(false);
	let packsMakerOpen = $state(false);

	const openClientName = $derived(data.clients.find((c) => c.id === openClientId)?.name ?? '');
	const balancesTotalPages = $derived(Math.max(1, Math.ceil(data.balancesTotal / data.balancesPerPage)));

	function gotoBalancesPage(target: number) {
		const url = new URL(window.location.href);
		url.searchParams.set('balancesPage', String(target));
		goto(`${url.pathname}${url.search}`, { keepFocus: true });
	}
</script>

<div class="payments-page">
	<ClientSidebar clients={data.clients} selectedClientId={openClientId} onselect={(id) => (openClientId = id)} />

	<div class="payments">
		<div class="header">
			<div class="title">Payments</div>
			<div class="header-actions">
				<Button variant="secondary" onclick={() => (packsMakerOpen = true)}>+ Add pack</Button>
				<Button variant="pop" onclick={() => (addChargeOpen = true)}>+ Add charge</Button>
			</div>
		</div>

		{#if data.doubleCharges.length > 0}
			<div class="double-charges" role="alert">
				{#each data.doubleCharges as dc (dc.id)}
					<div class="double-charge">
						<span>
							<strong>{dc.name}</strong> paid {formatCurrency(dc.amount, data.currency)} through Razorpay on
							{dc.date} for an invoice you'd already marked paid. Refund it from your Razorpay dashboard.
						</span>
						<form method="POST" action="?/dismissDoubleCharge" use:enhance>
							<input type="hidden" name="exceptionId" value={dc.id} />
							<Button type="submit" variant="secondary" size="sm">Dismiss</Button>
						</form>
					</div>
				{/each}
			</div>
		{/if}

		<div class="stat-row">
			<StatCard label="Paid this month" value={formatCurrency(data.summary.paid, data.currency)} accent="sage" />
			<StatCard label="Unpaid this month" value={formatCurrency(data.summary.unpaid, data.currency)} accent="citrus" />
			<StatCard label="Total this month" value={formatCurrency(data.summary.total, data.currency)} accent="plum" />
		</div>

		{#if data.packs.length > 0}
			<div class="section-title">Packs</div>
			<div class="balance-list">
				{#each data.packs as pack (pack.id)}
					<Card>
						<div class="pack-row">
							<span class="balance-name">{pack.clientName}</span>
							<span class="pack-detail">
								{pack.remaining} of {pack.sessionCount} sessions left
							</span>
						</div>
					</Card>
				{/each}
			</div>
		{/if}

		<div class="section-title">Who owes what</div>
		<div class="balance-list">
			{#each data.balances as b (b.key)}
				<Card interactive={!!b.clientId}>
					<!-- walk-in (no clientId) balances have no client history to drill into — the row is just the total -->
					<button
						type="button"
						class="balance-row"
						disabled={!b.clientId}
						onclick={() => b.clientId && (openClientId = b.clientId)}
					>
						<span class="balance-name">{b.name}</span>
						<span class="balance-owed">{formatCurrency(b.owed, data.currency)}</span>
					</button>
				</Card>
			{/each}
			{#if data.balances.length === 0}
				<div class="empty">No outstanding balances.</div>
			{/if}
		</div>
		{#if balancesTotalPages > 1}
			<div class="pager">
				<Button
					variant="secondary"
					size="sm"
					onclick={() => {
						if (data.balancesPage > 1) gotoBalancesPage(data.balancesPage - 1);
					}}>Prev</Button
				>
				<span class="pager-label">Page {data.balancesPage} of {balancesTotalPages}</span>
				<Button
					variant="secondary"
					size="sm"
					onclick={() => {
						if (data.balancesPage < balancesTotalPages) gotoBalancesPage(data.balancesPage + 1);
					}}>Next</Button
				>
			</div>
		{/if}
	</div>
</div>

<AddChargeDialog open={addChargeOpen} clients={data.clients} message={form?.message} onclose={() => (addChargeOpen = false)} />

<PacksMakerDialog
	open={packsMakerOpen}
	clients={data.clients}
	message={form?.message}
	onclose={() => (packsMakerOpen = false)}
/>

<ClientPaymentsDialog
	clientId={openClientId}
	clientName={openClientName}
	currency={data.currency}
	onclose={() => (openClientId = null)}
/>

<style>
	.payments-page {
		display: flex;
		gap: 24px;
	}

	/* ponytail: below 640px the client rail stacks above the content */
	@media (max-width: 640px) {
		.payments-page {
			flex-direction: column;
			gap: 16px;
		}
	}

	.payments {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 860px;
		flex: 1;
		min-width: 0;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 10px;
	}

	.header-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.pack-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.pack-detail {
		font-size: 13px;
		color: var(--text-muted);
	}

	.title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(24px, 5vw, 32px);
		color: var(--text-primary);
	}

	.double-charges {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.double-charge {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		font-size: 13px;
		color: var(--danger);
		background: var(--danger-bg);
		border: 2px dashed var(--danger);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.stat-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
		gap: 14px;
	}

	.section-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.balance-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.balance-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}

	.balance-name {
		font-weight: 700;
	}

	.balance-owed {
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--text-primary);
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.pager-label {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>