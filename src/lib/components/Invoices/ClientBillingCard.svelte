<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import Switch from '$lib/components/utils/Switch.svelte';
	import ClientBillingFields, { type ClientBillingDraft } from './ClientBillingFields.svelte';
	import { enhance } from '$lib/enhance';
	import type { TaxTypeChoice } from '$lib/invoice';

	export type ClientBillingCardData = {
		details: ClientBillingDraft;
		taxType: TaxTypeChoice;
		gstRate: string;
		autoInvoice: boolean;
	};

	// Therapist view of a client's billing: the shared details plus tax type and
	// GST rate, which only the therapist sets. Posts ?/saveBilling.
	// Remount per client ({#key}) — drafts are seeded once.
	let {
		initial,
		defaultGstRate,
		error
	}: {
		initial: ClientBillingCardData;
		defaultGstRate: string;
		error: { field: string; message: string } | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let details = $state(structuredClone(initial.details));
	// svelte-ignore state_referenced_locally
	let taxType = $state(initial.taxType);
	// svelte-ignore state_referenced_locally
	let gstRate = $state(initial.gstRate);
	// svelte-ignore state_referenced_locally
	let autoInvoice = $state(initial.autoInvoice);
	let saveLabel = $state('Save billing details');

	const TAX_TYPE_LABELS: { value: TaxTypeChoice; label: string }[] = [
		{ value: 'auto', label: 'Automatic (from the states)' },
		{ value: 'cgst_sgst', label: 'CGST + SGST' },
		{ value: 'igst', label: 'IGST' },
		{ value: 'none', label: 'No GST (exempt)' }
	];

	const taxTypeOptions: string[] = [];
	for (const option of TAX_TYPE_LABELS) {
		taxTypeOptions.push(option.label);
	}

	function getTaxTypeLabel(): string {
		for (const option of TAX_TYPE_LABELS) {
			if (option.value === taxType) {
				return option.label;
			}
		}
		return TAX_TYPE_LABELS[0].label;
	}

	function setTaxTypeLabel(label: string) {
		for (const option of TAX_TYPE_LABELS) {
			if (option.label === label) {
				taxType = option.value;
			}
		}
	}

	function errorFor(field: string): string {
		if (error && error.field === field) {
			return error.message;
		}
		return '';
	}
</script>

<Card>
	<form
		class="billing-form"
		method="POST"
		action="?/saveBilling"
		use:enhance={() => {
			return async ({ update, result }) => {
				await update({ reset: false });
				if (result.type === 'success') {
					saveLabel = 'Saved';
					setTimeout(() => (saveLabel = 'Save billing details'), 1400);
				}
			};
		}}
	>
		<div class="title">Billing Details</div>
		<div class="hint">Printed on this client's GST invoices. They can edit these in their portal too.</div>

		<ClientBillingFields bind:billing={details} {errorFor} />

		<input type="hidden" name="taxType" value={taxType} />
		<div class="grid-2">
			<div>
				<Select
					label="Tax Type"
					info="Automatic picks CGST + SGST when the client is in your state and IGST otherwise. Some therapy services are GST-exempt depending on your qualification and registration; check with your accountant before choosing No GST."
					options={taxTypeOptions}
					bind:value={getTaxTypeLabel, setTaxTypeLabel}
				/>
				{#if errorFor('taxType')}<span class="field-error" role="alert">{errorFor('taxType')}</span
					>{/if}
			</div>
			<Input
				label="GST Rate (%)"
				name="gstRate"
				placeholder="{defaultGstRate} (your default)"
				info="Leave blank to use the default rate from your invoice settings."
				error={errorFor('gstRate')}
				bind:value={gstRate}
			/>
		</div>

		{#if autoInvoice}
			<input type="hidden" name="autoInvoice" value="on" />
		{/if}
		<Switch
			label="Create invoices automatically when paid"
			info="Issues a GST invoice as soon as one of this client's payments is marked paid or paid online. Off by default. You can still issue invoices by hand either way."
			bind:checked={autoInvoice}
		/>

		<div>
			<Button type="submit" variant="primary" size="sm">{saveLabel}</Button>
		</div>
	</form>
</Card>

<style>
	.billing-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	.grid-2 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
		gap: 12px;
	}

	.field-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}
</style>
