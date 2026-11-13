<script lang="ts">
	import { enhance } from '$lib/enhance';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { formatCurrency } from '$lib/format';
	import { toast } from 'svelte-sonner';

	// The refund controls inside one expanded, paid payment row. Only rendered while the
	// payment has no live refund — once refunded, the row shows Paid / Refunded / Remaining
	// instead (see PaymentHistoryList). One refund per payment; docs/refunds.md.
	let {
		paymentId,
		amount,
		paidVia,
		currency,
		onchange
	}: {
		paymentId: string;
		amount: number;
		paidVia: 'manual' | 'razorpay';
		currency: string;
		onchange: () => void;
	} = $props();

	let method = $state<'razorpay' | 'manual' | null>(null);
	let confirming = $state(false);
	let error = $state<string | null>(null);
	let refundAmount = $state('');

	const parsedAmount = $derived(Number(refundAmount));
	const amountValid = $derived(
		Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= amount
	);

	function open(chosen: 'razorpay' | 'manual') {
		method = chosen;
		confirming = false;
		error = null;
		refundAmount = String(amount);
	}

	function close() {
		method = null;
		confirming = false;
		error = null;
	}

	function askConfirm() {
		if (!amountValid) {
			error = `Enter a whole number from 1 to ${amount}.`;
			return;
		}
		error = null;
		confirming = true;
	}

	function confirmText(): string {
		const formatted = formatCurrency(parsedAmount, currency);
		if (method === 'razorpay') {
			return `Send ${formatted} back to the client through Razorpay? This can't be undone, and no further refund is possible on this payment.`;
		}
		return `Record that you paid ${formatted} back yourself? No money is sent, and no further refund is possible on this payment.`;
	}

	function fieldLabel(): string {
		if (method === 'razorpay') {
			return 'Refund via Razorpay (₹)';
		}
		return 'Manual refund (₹)';
	}

	function action(): string {
		if (method === 'razorpay') {
			return '?/refundRazorpay';
		}
		return '?/refundManual';
	}
</script>

{#if method === null}
	<div class="refund-actions">
		{#if paidVia === 'razorpay'}
			<Button type="button" variant="secondary" size="sm" onclick={() => open('razorpay')}>
				Refund via Razorpay
			</Button>
		{/if}
		<Button type="button" variant="secondary" size="sm" onclick={() => open('manual')}>
			Record manual refund
		</Button>
	</div>
{:else}
	<form
		class="refund-form"
		method="POST"
		action={action()}
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'failure') {
					let message = 'The refund could not be completed.';
					if (typeof result.data?.message === 'string') {
						message = result.data.message;
					}
					error = message;
					confirming = false;
					// a timed-out refund leaves a pending row behind, so refresh either way
					onchange();
					return;
				}
				if (result.type === 'success') {
					if (result.data?.refundStatus === 'pending') {
						toast.success('Refund sent — Razorpay is still processing it.');
					} else {
						toast.success('Refund recorded.');
					}
					close();
					onchange();
				}
			};
		}}
	>
		<input type="hidden" name="paymentId" value={paymentId} />
		<div class="refund-fields">
			<Input
				name="amount"
				label={fieldLabel()}
				bind:value={refundAmount}
			/>
			{#if !confirming}
				<Button type="button" variant="primary" size="sm" onclick={askConfirm}>Refund</Button>
				<Button type="button" variant="secondary" size="sm" onclick={close}>Cancel</Button>
			{/if}
		</div>
		{#if confirming}
			<div class="refund-confirm">
				<span>{confirmText()}</span>
				<div class="refund-actions">
					<Button type="submit" variant="primary" size="sm">Confirm refund</Button>
					<Button type="button" variant="secondary" size="sm" onclick={() => (confirming = false)}>
						Back
					</Button>
				</div>
			</div>
		{/if}
		{#if error}
			<div class="refund-error" role="alert">{error}</div>
		{/if}
	</form>
{/if}

<style>
	.refund-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.refund-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.refund-fields {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		flex-wrap: wrap;
	}

	.refund-fields :global(.field) {
		width: 140px;
	}

	.refund-confirm {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 13px;
		color: var(--text-primary);
	}

	.refund-error {
		font-size: 13px;
		font-weight: 700;
		color: var(--danger, var(--warning));
	}
</style>
