<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import InfoTip from '$lib/components/utils/InfoTip.svelte';
	import InvoiceExtraFieldsEditor from './InvoiceExtraFieldsEditor.svelte';
	import { GST_STATES } from '$lib/invoice';
	import type { InvoiceExtraField } from '$lib/invoiceValidation';

	export type ClientBillingDraft = {
		companyName: string;
		billingEmail: string;
		address: string;
		gstin: string;
		stateCode: string;
		extraFields: InvoiceExtraField[];
	};

	// The client's billing details, editable by the client (portal) and the
	// therapist (client page). Fields only — the parent owns the <form>.
	let {
		billing = $bindable(),
		errorFor
	}: {
		billing: ClientBillingDraft;
		errorFor: (field: string) => string;
	} = $props();

	const NO_STATE_LABEL = 'Not set';

	const stateLabels: string[] = [NO_STATE_LABEL];
	for (const state of GST_STATES) {
		stateLabels.push(`${state.code} · ${state.name}`);
	}

	function getStateLabel(): string {
		for (const state of GST_STATES) {
			if (state.code === billing.stateCode) {
				return `${state.code} · ${state.name}`;
			}
		}
		return NO_STATE_LABEL;
	}

	function setStateLabel(label: string) {
		if (label === NO_STATE_LABEL) {
			billing.stateCode = '';
		} else {
			billing.stateCode = label.slice(0, 2);
		}
	}
</script>

<input type="hidden" name="stateCode" value={billing.stateCode} />

<div class="grid-2">
	<Input
		label="Bill To (optional)"
		name="companyName"
		info="A company or another name to put on the invoice. Leave blank to use the client's name."
		bind:value={billing.companyName}
	/>
	<Input
		label="Billing Email (optional)"
		name="billingEmail"
		type="email"
		info="Where invoices are emailed. Leave blank to use the client's own email."
		error={errorFor('billingEmail')}
		bind:value={billing.billingEmail}
	/>
</div>
<Textarea label="Billing Address (optional)" name="address" rows={3} bind:value={billing.address} />
<div class="grid-2">
	<div>
		<Select
			label="State"
			info="Decides whether CGST + SGST or IGST applies. Pick 96 for someone outside India."
			options={stateLabels}
			bind:value={getStateLabel, setStateLabel}
		/>
		{#if errorFor('stateCode')}<span class="field-error" role="alert">{errorFor('stateCode')}</span
			>{/if}
	</div>
	<Input
		label="GSTIN (optional)"
		name="gstin"
		info="Only if billing a GST-registered business, so it can claim the tax back. 15 characters."
		error={errorFor('gstin')}
		bind:value={billing.gstin}
	/>
</div>
<div class="field-label">
	Extra Fields (optional)<InfoTip
		label="Extra Fields"
		text="Anything else to print with the billing details, like a PO number or employee ID."
	/>
</div>
<InvoiceExtraFieldsEditor bind:fields={billing.extraFields} error={errorFor('extraFields')} />

<style>
	.grid-2 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
		gap: 12px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.field-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}
</style>
