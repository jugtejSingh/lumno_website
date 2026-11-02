<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import type { InvoiceDraft, TaxTypeChoice } from '$lib/invoice';

	let { invoice = $bindable() }: { invoice: InvoiceDraft } = $props();

	const TAX_TYPE_OPTIONS: { value: TaxTypeChoice; label: string }[] = [
		{ value: 'auto', label: 'Auto (from states)' },
		{ value: 'cgst_sgst', label: 'CGST + SGST' },
		{ value: 'igst', label: 'IGST' },
		{ value: 'none', label: 'No GST (Bill of Supply)' }
	];

	const taxTypeLabels: string[] = [];
	for (const option of TAX_TYPE_OPTIONS) {
		taxTypeLabels.push(option.label);
	}

	function getTaxTypeLabel(): string {
		for (const option of TAX_TYPE_OPTIONS) {
			if (option.value === invoice.taxType) {
				return option.label;
			}
		}
		return TAX_TYPE_OPTIONS[0].label;
	}

	function setTaxTypeLabel(label: string) {
		for (const option of TAX_TYPE_OPTIONS) {
			if (option.label === label) {
				invoice.taxType = option.value;
			}
		}
	}
</script>

<fieldset class="meta">
	<legend>Invoice details</legend>
	<div class="row">
		<Input label="Invoice number" placeholder="ANV/2026-27/001" bind:value={invoice.number} />
		<Input label="Date" type="date" bind:value={invoice.date} />
	</div>
	<Select
		label="Tax type"
		info="Auto uses CGST + SGST when you and the buyer are in the same state, IGST otherwise, and no GST if you have no GSTIN."
		options={taxTypeLabels}
		bind:value={getTaxTypeLabel, setTaxTypeLabel}
	/>
</fieldset>

<style>
	.meta {
		display: flex;
		flex-direction: column;
		gap: 12px;
		border: none;
		margin: 0;
		padding: 0;
	}

	legend {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 16px;
		color: var(--text-primary);
		margin-bottom: 12px;
		padding: 0;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	@media (max-width: 520px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
