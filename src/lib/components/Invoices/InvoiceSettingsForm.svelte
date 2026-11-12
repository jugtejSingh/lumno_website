<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import InfoTip from '$lib/components/utils/InfoTip.svelte';
	import InvoiceExtraFieldsEditor from './InvoiceExtraFieldsEditor.svelte';
	import InvoiceImageField from './InvoiceImageField.svelte';
	import { GST_STATES } from '$lib/invoice';
	import { MAX_PREFIX_LENGTH, type InvoiceExtraField } from '$lib/invoiceValidation';

	export type InvoiceSettingsDraft = {
		legalName: string;
		address: string;
		stateCode: string;
		gstin: string;
		sacCode: string;
		defaultGstRate: string;
		numberPrefix: string;
		nextNumber: string;
		footer: string;
		extraFields: InvoiceExtraField[];
	};

	// Fields only — the page owns the <form> and its save action.
	let {
		settings = $bindable(),
		logoUrl,
		signatureUrl,
		logoFileName = $bindable(''),
		signatureFileName = $bindable(''),
		removeLogo = $bindable(false),
		removeSignature = $bindable(false),
		errorFor
	}: {
		settings: InvoiceSettingsDraft;
		logoUrl: string | null;
		signatureUrl: string | null;
		logoFileName?: string;
		signatureFileName?: string;
		removeLogo?: boolean;
		removeSignature?: boolean;
		errorFor: (field: string) => string;
	} = $props();

	const NO_STATE_LABEL = 'Choose a state';

	// Select works on labels; the form posts the 2-digit code. 96 (outside India)
	// is a buyer-only code.
	const stateLabels: string[] = [NO_STATE_LABEL];
	for (const state of GST_STATES) {
		if (state.code !== '96') {
			stateLabels.push(`${state.code} · ${state.name}`);
		}
	}

	function getStateLabel(): string {
		for (const state of GST_STATES) {
			if (state.code === settings.stateCode) {
				return `${state.code} · ${state.name}`;
			}
		}
		return NO_STATE_LABEL;
	}

	function setStateLabel(label: string) {
		if (label === NO_STATE_LABEL) {
			settings.stateCode = '';
		} else {
			settings.stateCode = label.slice(0, 2);
		}
	}

	// current April–March financial year, e.g. 2026-27, for the preview only
	function currentFinancialYear(): string {
		const now = new Date();
		let startYear = now.getFullYear();
		if (now.getMonth() < 3) {
			startYear = startYear - 1;
		}
		const endYear = String(startYear + 1).slice(2);
		return `${startYear}-${endYear}`;
	}

	// what the next invoice number will look like, for the helper line
	const numberPreview = $derived.by(() => {
		let sequence = Number(settings.nextNumber);
		if (!Number.isInteger(sequence) || sequence < 1) {
			sequence = 1;
		}
		const tail = `${currentFinancialYear()}/${String(sequence).padStart(4, '0')}`;
		if (settings.numberPrefix.trim() === '') {
			return tail;
		}
		return `${settings.numberPrefix.trim()}/${tail}`;
	});
</script>

<input type="hidden" name="stateCode" value={settings.stateCode} />

<div class="section">
	<div class="section-title">Your Details</div>
	<Input
		label="Legal Name (optional)"
		name="legalName"
		info="The name printed as the seller. Leave blank to use your account name."
		bind:value={settings.legalName}
	/>
	<Textarea label="Address" name="address" rows={3} bind:value={settings.address} />
	{#if errorFor('address')}<span class="field-error" role="alert">{errorFor('address')}</span>{/if}
	<div class="grid-2">
		<div>
			<Select label="State" options={stateLabels} bind:value={getStateLabel, setStateLabel} />
			{#if errorFor('stateCode')}<span class="field-error" role="alert"
					>{errorFor('stateCode')}</span
				>{/if}
		</div>
		<Input
			label="GSTIN (optional)"
			name="gstin"
			info="15 characters, e.g. 27AAPFU0939F1ZV. Leave blank if you're not GST registered — your invoices will be Bills of Supply. Some therapy services are GST-exempt depending on your qualification and registration; check with your accountant."
			error={errorFor('gstin')}
			bind:value={settings.gstin}
		/>
	</div>
</div>

<div class="section">
	<div class="section-title">Tax</div>
	<div class="grid-2">
		<Input
			label="SAC Code"
			name="sacCode"
			info="GST's code for your service. 9993 covers human health and social care. Confirm the right code with your accountant. You can change it per line on an invoice."
			error={errorFor('sacCode')}
			bind:value={settings.sacCode}
		/>
		<Input
			label="Default GST Rate (%)"
			name="defaultGstRate"
			info="Whole number, e.g. 18. Used for every client unless you set a different rate on their billing details. Check the current rate with your accountant."
			error={errorFor('defaultGstRate')}
			bind:value={settings.defaultGstRate}
		/>
	</div>
</div>

<div class="section">
	<div class="section-title">
		Invoice Numbers<InfoTip
			label="Invoice Numbers"
			text="Numbers restart at 0001 every April, with the financial year in the middle."
		/>
	</div>
	<div class="grid-2">
		<Input
			label="Prefix (optional)"
			name="numberPrefix"
			info="Up to {MAX_PREFIX_LENGTH} letters or digits, e.g. your initials. GST limits invoice numbers to 16 characters."
			error={errorFor('numberPrefix')}
			bind:value={settings.numberPrefix}
		/>
		<Input
			label="Next Invoice Number"
			name="nextNumber"
			info="Moving from another tool or paper invoices? Set this to carry on from your last number."
			error={errorFor('nextNumber')}
			bind:value={settings.nextNumber}
		/>
	</div>
	<div class="helper">Your next invoice will be numbered {numberPreview}.</div>
</div>

<div class="section">
	<div class="section-title">Printed On Every Invoice</div>
	<Textarea
		label="Footer (optional)"
		name="footer"
		rows={4}
		placeholder="Bank / UPI details, payment terms, a thank-you line"
		bind:value={settings.footer}
	/>
	<div class="field-label">
		Extra Fields (optional)<InfoTip
			label="Extra Fields"
			text="Anything else to print under your details, like PAN or a registration number."
		/>
	</div>
	<InvoiceExtraFieldsEditor bind:fields={settings.extraFields} error={errorFor('extraFields')} />
	<div class="grid-2">
		<InvoiceImageField
			label="Logo"
			info="PNG, JPEG or WebP, under 2 MB. Printed at the top of each invoice."
			name="logo"
			removeName="removeLogo"
			currentUrl={logoUrl}
			error={errorFor('logo')}
			bind:fileName={logoFileName}
			bind:remove={removeLogo}
		/>
		<InvoiceImageField
			label="Signature"
			info="PNG, JPEG or WebP, under 2 MB. Printed above the signatory line."
			name="signature"
			removeName="removeSignature"
			currentUrl={signatureUrl}
			error={errorFor('signature')}
			bind:fileName={signatureFileName}
			bind:remove={removeSignature}
		/>
	</div>
</div>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.section-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.field-label {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.grid-2 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
		gap: 12px;
	}

	.helper {
		font-size: 13px;
		color: var(--text-muted);
	}

	.field-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}
</style>
