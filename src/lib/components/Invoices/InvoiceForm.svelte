<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import InvoiceMetaFields from './InvoiceMetaFields.svelte';
	import InvoicePartySummary from './InvoicePartySummary.svelte';
	import InvoiceLinesEditor from './InvoiceLinesEditor.svelte';
	import type { InvoiceDraft } from '$lib/invoice';

	// Your details and the footer come from invoice settings and can't be
	// changed per invoice; the buyer, lines, date and tax type can.
	let { invoice = $bindable() }: { invoice: InvoiceDraft } = $props();
</script>

<Card>
	<div class="form">
		<InvoiceMetaFields bind:invoice />
		<InvoicePartySummary
			title="Your details"
			nameLabel="Legal name"
			gstinInfo=""
			emptyText="Add your business details in invoice settings."
			editHref="/settings/invoices"
			bind:party={invoice.seller}
		/>
		<InvoicePartySummary
			title="Bill to"
			nameLabel="Company or client name"
			gstinInfo="The buyer's GSTIN, if they want to claim input tax credit."
			emptyText="Add who this invoice is for."
			bind:party={invoice.buyer}
		/>
		<InvoiceLinesEditor bind:lines={invoice.lines} />
	</div>
</Card>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
</style>
