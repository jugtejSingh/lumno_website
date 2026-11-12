<!-- styles inlined into server-rendered HTML for the emailed PDF (invoicePdf.ts) -->
<svelte:options css="injected" />

<script lang="ts">
	import InvoiceHeader from './InvoiceHeader.svelte';
	import InvoiceParties from './InvoiceParties.svelte';
	import InvoiceLines from './InvoiceLines.svelte';
	import InvoiceTotals from './InvoiceTotals.svelte';
	import InvoiceFooter from './InvoiceFooter.svelte';
	import { computeInvoice, type InvoiceDraft } from '$lib/invoice';

	// Read-only on purpose: it only renders `invoice`, so the server can render
	// the same component to HTML for the PDF later. When printed (Download) only
	// this sheet shows, on one A4 page.
	let {
		invoice,
		logoUrl = null,
		signatureUrl = null,
		cancelled = false
	}: {
		invoice: InvoiceDraft;
		logoUrl?: string | null;
		signatureUrl?: string | null;
		cancelled?: boolean;
	} = $props();

	const computed = $derived(computeInvoice(invoice));
</script>

<article class="sheet" aria-label="Invoice">
	{#if cancelled}
		<div class="cancelled-mark" aria-label="This invoice is cancelled">Cancelled</div>
	{/if}
	<InvoiceHeader title={computed.title} number={invoice.number} date={invoice.date} {logoUrl} />
	<InvoiceParties seller={invoice.seller} buyer={invoice.buyer} />
	<InvoiceLines lines={computed.lines} taxType={computed.taxType} />
	<InvoiceTotals {computed} />
	<InvoiceFooter footer={invoice.footer} sellerName={invoice.seller.name} {signatureUrl} />
</article>

<style>
	/* Paper colours stay fixed whatever the app theme — this is a printed document. */
	.sheet {
		--invoice-ink: #1f1a17;
		--invoice-muted: #6b625c;
		--invoice-rule: #d9d2cc;
		--invoice-shade: #f5f1ed;

		position: relative;
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
		overflow: hidden;
	}

	.cancelled-mark {
		position: absolute;
		top: 38%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(-24deg);
		padding: 6px 28px;
		border: 4px solid #c0392b;
		color: #c0392b;
		font-size: 56px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.55;
		pointer-events: none;
	}

	/* on narrow screens let it grow taller than A4 rather than squash the text */
	@media (max-width: 820px) {
		.sheet {
			aspect-ratio: auto;
			min-height: 0;
		}
	}

	@page {
		size: A4;
		margin: 0;
	}

	@media print {
		/* only the sheet prints; the page is clipped to one A4 so the hidden app
		   around it can't add blank pages */
		:global(html),
		:global(body) {
			height: 297mm;
			overflow: hidden;
		}

		:global(body *) {
			visibility: hidden;
		}

		.sheet,
		.sheet :global(*) {
			visibility: visible;
		}

		.sheet {
			position: fixed;
			top: 0;
			left: 0;
			width: 210mm;
			height: 297mm;
			max-width: none;
			aspect-ratio: auto;
			padding: 16mm;
			border: none;
			box-shadow: none;
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
	}
</style>
