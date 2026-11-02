<script lang="ts">
	import { formatRupees, type ComputedInvoice } from '$lib/invoice';

	let { computed }: { computed: ComputedInvoice } = $props();
</script>

<dl class="totals">
	{#if computed.taxType !== 'none'}
		<div>
			<dt>Taxable value</dt>
			<dd>{formatRupees(computed.taxablePaise)}</dd>
		</div>
	{/if}
	{#if computed.taxType === 'cgst_sgst'}
		<div>
			<dt>CGST</dt>
			<dd>{formatRupees(computed.cgstPaise)}</dd>
		</div>
		<div>
			<dt>SGST</dt>
			<dd>{formatRupees(computed.sgstPaise)}</dd>
		</div>
	{/if}
	{#if computed.taxType === 'igst'}
		<div>
			<dt>IGST</dt>
			<dd>{formatRupees(computed.igstPaise)}</dd>
		</div>
	{/if}
	<div class="grand">
		<dt>Total</dt>
		<dd>{formatRupees(computed.totalPaise)}</dd>
	</div>
</dl>

<style>
	.totals {
		margin: 14px 0 0 auto;
		width: min(100%, 280px);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.totals div {
		display: flex;
		justify-content: space-between;
		gap: 16px;
	}

	dt {
		color: var(--invoice-muted);
	}

	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.grand {
		margin-top: 4px;
		padding-top: 8px;
		border-top: 2px solid var(--invoice-ink);
		font-weight: 700;
		font-size: 15px;
	}

	.grand dt {
		color: var(--invoice-ink);
	}
</style>
