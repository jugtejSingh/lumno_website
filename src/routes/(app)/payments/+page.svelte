<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import StatCard from '$lib/components/utils/StatCard.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import AddChargeDialog from '$lib/components/Payments/AddChargeDialog.svelte';
	import ClientPaymentsDialog from '$lib/components/Payments/ClientPaymentsDialog.svelte';
	import ClientSidebar from '$lib/components/Payments/ClientSidebar.svelte';
	import { formatCurrency } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let openClientId = $state<string | null>(null);
	let addChargeOpen = $state(false);

	const openClientName = $derived(data.clients.find((c) => c.id === openClientId)?.name ?? '');
</script>

<div class="payments-page">
	<ClientSidebar clients={data.clients} selectedClientId={openClientId} onselect={(id) => (openClientId = id)} />

	<div class="payments">
		<div class="header">
			<div class="title">Payments</div>
			<Button variant="pop" onclick={() => (addChargeOpen = true)}>+ Add charge</Button>
		</div>

		<div class="stat-row">
			<StatCard label="Paid this month" value={formatCurrency(data.summary.paid, data.currency)} accent="sage" />
			<StatCard label="Unpaid this month" value={formatCurrency(data.summary.unpaid, data.currency)} accent="citrus" />
			<StatCard label="Total this month" value={formatCurrency(data.summary.total, data.currency)} accent="plum" />
		</div>

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
	</div>
</div>

<AddChargeDialog open={addChargeOpen} clients={data.clients} message={form?.message} onclose={() => (addChargeOpen = false)} />

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

	.title {
		font-family: var(--font-display);
		font-size: clamp(24px, 5vw, 32px);
		color: var(--text-primary);
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
</style>