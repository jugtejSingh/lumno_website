<script lang="ts">
	import { enhance } from '$lib/enhance';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import PaymentHistoryList from '$lib/components/Payments/PaymentHistoryList.svelte';
	import { formatCurrency } from '$lib/format';
	import type { ClientPaymentTotals } from '$lib/types/payments';

	let {
		clientId,
		clientName,
		currency,
		onclose
	}: {
		clientId: string | null;
		clientName: string;
		currency: string;
		onclose: () => void;
	} = $props();

	let totals = $state<ClientPaymentTotals>({ owed: 0, paidThisMonth: 0, paidThisYear: 0 });
	let historyList: { refresh: () => void } | undefined = $state();

	// PaymentHistoryList's own fetch (against the same GET endpoint) already returns totals
	// alongside the page of rows — grabbed here via ontotals instead of fetching them again.
	function handleTotals(t: ClientPaymentTotals) {
		totals = t;
	}
</script>

<Dialog
	open={!!clientId}
	title={clientId ? `${clientName} — payment history` : ''}
	width="clamp(320px, 56vw, 680px)"
	{onclose}
>
	{#if clientId}
		<div class="modal">
			<div class="stat-row">
				<div class="stat">
					<div class="stat-label">Owed</div>
					<div class="stat-value">{formatCurrency(totals.owed, currency)}</div>
				</div>
				<div class="stat">
					<div class="stat-label">Paid this month</div>
					<div class="stat-value">{formatCurrency(totals.paidThisMonth, currency)}</div>
				</div>
				<div class="stat">
					<div class="stat-label">Paid this year</div>
					<div class="stat-value">{formatCurrency(totals.paidThisYear, currency)}</div>
				</div>
			</div>

			<PaymentHistoryList bind:this={historyList} {clientId} {currency} editable ontotals={handleTotals} />

			<form
				class="modal-add-charge"
				method="POST"
				action="?/addCharge"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						historyList?.refresh();
					};
				}}
			>
				<input type="hidden" name="clientId" value={clientId} />
				<Input name="amount" placeholder="Amount" />
				<Input name="note" placeholder="Note (e.g. late fee)" />
				<Button type="submit" variant="secondary" size="sm">+ Add charge</Button>
			</form>
		</div>
	{/if}
</Dialog>

<style>
	.modal {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* three across even on a phone — they're short enough, and wrapping them stole
	   the height the history rows need */
	.stat-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		border-bottom: 2px dotted var(--beige-400);
		padding-bottom: 10px;
	}

	.stat {
		min-width: 0;
	}

	.stat-label {
		font-size: 12px;
		color: var(--text-muted);
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.modal-add-charge {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		flex-wrap: wrap;
		border-top: 2px dotted var(--beige-400);
		padding-top: 14px;
	}

	.modal-add-charge :global(.field:first-of-type) {
		width: 110px;
	}

	.modal-add-charge :global(.field:nth-of-type(2)) {
		flex: 1;
		min-width: 140px;
	}

	@media (max-width: 520px) {
		.modal-add-charge :global(.field) {
			flex: 1 0 100%;
			width: 100%;
		}
	}
</style>