<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import InvoiceMetaFields from './InvoiceMetaFields.svelte';
	import InvoicePartySummary from './InvoicePartySummary.svelte';
	import InvoiceLinesEditor from './InvoiceLinesEditor.svelte';
	import type { InvoiceDraft } from '$lib/invoice';

	// Only per-invoice fields live on the form; saved details sit behind the
	// summaries' dialogs.
	let { invoice = $bindable() }: { invoice: InvoiceDraft } = $props();
</script>

<Card>
	<div class="form">
		<InvoiceMetaFields bind:invoice />
		<InvoicePartySummary
			title="Your details"
			nameLabel="Legal name"
			gstinInfo="Leave blank if you're not GST-registered — the invoice becomes a Bill of Supply."
			emptyText="Add your business details to appear on the invoice."
			bind:party={invoice.seller}
		>
			<Textarea
				label="Footer"
				info="Bank or UPI details, payment terms, a thank-you line."
				rows={3}
				bind:value={invoice.footer}
			/>
		</InvoicePartySummary>
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
