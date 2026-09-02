<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import StatCard from '$lib/components/utils/StatCard.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import SessionPacksList from '$lib/components/Payments/SessionPacksList.svelte';
	import PaymentSettingsForm from '$lib/components/Payments/PaymentSettingsForm.svelte';
	import AddChargeDialog from '$lib/components/Payments/AddChargeDialog.svelte';
	import AddPackDialog from '$lib/components/Payments/AddPackDialog.svelte';
	import ClientPaymentsDialog from '$lib/components/Payments/ClientPaymentsDialog.svelte';
	import ClientSidebar from '$lib/components/Payments/ClientSidebar.svelte';
	import { formatCurrency } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let openClientId = $state<string | null>(null);
	let addPackOpen = $state(false);
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
			{#each data.balances as b (b.clientId)}
				<Card interactive>
					<button type="button" class="balance-row" onclick={() => (openClientId = b.clientId)}>
						<span class="balance-name">{b.name}</span>
						<span class="balance-owed">{formatCurrency(b.owed, data.currency)}</span>
					</button>
				</Card>
			{/each}
			{#if data.balances.length === 0}
				<div class="empty">No outstanding balances.</div>
			{/if}
		</div>

		<SessionPacksList packs={data.packs} message={form?.message} onAddPack={() => (addPackOpen = true)} />

		<PaymentSettingsForm
			packsEnabled={data.paymentSettings.packsEnabled}
			packExhaustedAction={data.paymentSettings.packExhaustedAction}
			packExhaustedActionOptions={data.packExhaustedActionOptions}
			hourOptions={data.hourOptions}
			freeChangeWindowHours={data.paymentSettings.freeChangeWindowHours}
			partialChangeWindowHours={data.paymentSettings.partialChangeWindowHours}
			message={form?.message}
		/>
	</div>
</div>

<AddChargeDialog open={addChargeOpen} clients={data.clients} message={form?.message} onclose={() => (addChargeOpen = false)} />

<AddPackDialog open={addPackOpen} clients={data.clients} message={form?.message} onclose={() => (addPackOpen = false)} />

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
	}

	.title {
		font-family: var(--font-display);
		font-size: 32px;
		color: var(--text-primary);
	}

	.stat-row {
		display: flex;
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