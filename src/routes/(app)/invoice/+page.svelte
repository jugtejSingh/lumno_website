<script lang="ts">
	import InvoiceForm from '$lib/components/Invoices/InvoiceForm.svelte';
	import InvoiceDocument from '$lib/components/Invoices/InvoiceDocument.svelte';
	import { emptyInvoice, todayInTimezone } from '$lib/invoice';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ponytail: lives only in the page — a refresh starts over. Saved template
	// and client details come in later steps of docs/invoice.md.
	// svelte-ignore state_referenced_locally
	let invoice = $state(emptyInvoice(todayInTimezone(data.therapist.timezone)));
</script>

<svelte:head>
	<title>Invoice — Lumno</title>
</svelte:head>

<div class="invoice-page">
	<div class="editor">
		<h1>Invoice</h1>
		<InvoiceForm bind:invoice />
	</div>
	<div class="preview">
		<InvoiceDocument {invoice} />
	</div>
</div>

<style>
	.invoice-page {
		display: grid;
		grid-template-columns: minmax(320px, 440px) minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}

	h1 {
		margin: 0 0 16px;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.preview {
		position: sticky;
		top: 0;
		display: flex;
		justify-content: center;
	}

	@media (max-width: 1100px) {
		.invoice-page {
			grid-template-columns: minmax(0, 1fr);
		}

		.preview {
			position: static;
		}
	}
</style>
