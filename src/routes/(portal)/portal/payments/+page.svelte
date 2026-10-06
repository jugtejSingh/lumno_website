<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Card from '$lib/components/utils/Card.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import StatCard from '$lib/components/utils/StatCard.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Pager from '$lib/components/utils/Pager.svelte';
	import { enhance } from '$lib/enhance';
	import { PAY_ERRORS, openInvoiceCheckout, type InvoiceCheckout } from '$lib/portalCheckout';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let payingId = $state<string | null>(null);

	function gotoPage(target: number) {
		goto(`?page=${target}`, { keepFocus: true });
	}
</script>

<div class="section">
	<div class="section-title">Payments</div>
	<div class="stat-row">
		<StatCard label="Balance due" value={data.balanceDue} accent="citrus" />
	</div>
	{#if data.manualPay && data.hasBalanceDue}
		<Card>
			<div class="pay-how">
				<div class="row-title">How to pay {data.therapistName.split(' ')[0]}</div>
				<div class="row-sub">
					Prefer to pay directly? Use the details below. The full amount goes straight to your
					practitioner. Then let them know so they can mark the invoice as paid.
				</div>
				<div class="pay-how-body">
					{#if data.manualPay.qrUrl}
						<img class="pay-qr" src={data.manualPay.qrUrl} alt="Payment QR code" />
					{/if}
					{#if data.manualPay.bankDetails}
						<pre class="pay-bank">{data.manualPay.bankDetails}</pre>
					{/if}
				</div>
			</div>
		</Card>
	{/if}
	<div class="invoice-list">
		{#each data.invoices as inv (inv.id)}
			<Card>
				<div class="row">
					<div class="row-info">
						<div class="row-title">{inv.date}</div>
						<div class="row-sub">{inv.note ?? `Session with ${data.therapistName}`}</div>
					</div>
					<div class="amount">{inv.amount}</div>
					{#if inv.refund === null}
						<Badge tone="citrus">unpaid</Badge>
					{:else if inv.refund.done}
						<Badge tone="success">refunded {inv.refund.amount}</Badge>
					{:else}
						<Badge tone="warning">refund {inv.refund.amount} pending</Badge>
					{/if}
					{#if inv.payable}
						<form
							method="POST"
							action="?/payInvoice"
							use:enhance={() => {
								payingId = inv.id;
								return async ({ result }) => {
									if (result.type === 'success' && result.data?.checkout) {
										await openInvoiceCheckout(result.data.checkout as InvoiceCheckout, () => {
											payingId = null;
										});
									} else {
										payingId = null;
										let message = 'Could not start checkout. Please try again.';
										if (result.type === 'failure') {
											message = PAY_ERRORS[String(result.data?.message)] ?? message;
										}
										toast.error(message);
									}
								};
							}}
						>
							<input type="hidden" name="paymentId" value={inv.id} />
							<Button type="submit" size="sm">
								{#if payingId === inv.id}
									Opening…
								{:else}
									Pay now
								{/if}
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
	<Pager page={data.page} totalPages={data.totalPages} ongoto={gotoPage} />
</div>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 760px;
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hint {
		font-size: 13px;
		color: var(--text-muted);
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

	.amount {
		font-weight: 700;
		color: var(--text-primary);
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

	.pay-how {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.pay-how-body {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-start;
		margin-top: 6px;
	}

	.pay-qr {
		width: 180px;
		height: 180px;
		object-fit: contain;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
	}

	.pay-bank {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		white-space: pre-wrap;
		margin: 0;
		user-select: all;
	}
</style>
