<script lang="ts">
	import InvoiceHeader from './InvoiceHeader.svelte';
	import InvoiceParties from './InvoiceParties.svelte';
	import InvoiceLines from './InvoiceLines.svelte';
	import InvoiceTotals from './InvoiceTotals.svelte';
	import InvoiceFooter from './InvoiceFooter.svelte';
	import { computeInvoice, type InvoiceDraft } from '$lib/invoice';

	// Read-only on purpose: it only renders `invoice`, so the server can render
	// the same component to HTML for the PDF later.
	let { invoice }: { invoice: InvoiceDraft } = $props();

	const computed = $derived(computeInvoice(invoice));
</script>

<article class="sheet" aria-label="Invoice preview">
	<InvoiceHeader title={computed.title} number={invoice.number} date={invoice.date} />
	<InvoiceParties seller={invoice.seller} buyer={invoice.buyer} />
	<InvoiceLines lines={computed.lines} taxType={computed.taxType} />
	<InvoiceTotals {computed} />
	<InvoiceFooter footer={invoice.footer} sellerName={invoice.seller.name} />
</article>

<style>
	/* Paper colours stay fixed whatever the app theme — this is a printed document. */
	.sheet {
		--invoice-ink: #1f1a17;
		--invoice-muted: #6b625c;
		--invoice-rule: #d9d2cc;
		--invoice-shade: #f5f1ed;

		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: 100%;
		max-width: 794px; /* A4 at 96dpi */
		aspect-ratio: 210 / 297;
		padding: clamp(20px, 5%, 48px);
		background: #ffffff;
		color: var(--invoice-ink);
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.45;
		border: 1px solid var(--invoice-rule);
		box-shadow: var(--shadow-md);
	}

	/* on narrow screens let it grow taller than A4 rather than squash the text */
	@media (max-width: 820px) {
		.sheet {
			aspect-ratio: auto;
			min-height: 0;
		}
	}
</style>
