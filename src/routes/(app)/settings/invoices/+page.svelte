<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import InvoiceSettingsForm from '$lib/components/Invoices/InvoiceSettingsForm.svelte';
	import { enhance } from '$lib/enhance';
	import { untrack } from 'svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// seeded from the first load only, so a save doesn't reset what's on screen
	let settings = $state(structuredClone(untrack(() => data.settings)));
	let logoFileName = $state('');
	let signatureFileName = $state('');
	let removeLogo = $state(false);
	let removeSignature = $state(false);

	function currentValues(): string {
		return JSON.stringify([settings, logoFileName, signatureFileName, removeLogo, removeSignature]);
	}
	let savedValues = $state(currentValues());
	const dirty = $derived(currentValues() !== savedValues);
	let saveLabel = $state('Save Changes');

	function errorFor(field: string): string {
		if (form && 'field' in form && form.field === field && form.message) {
			return form.message;
		}
		return '';
	}

	function hasGeneralError(): boolean {
		if (!form || !('message' in form) || !form.message) {
			return false;
		}
		if ('field' in form && form.field) {
			return false;
		}
		return true;
	}
</script>

<svelte:head>
	<title>Invoice Settings — Lumno</title>
</svelte:head>

<form
	class="invoice-settings"
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	use:enhance={() => {
		return async ({ update, result }) => {
			// a new logo/signature needs its fresh signed URL, so let the load rerun
			await update({ reset: false });
			if (result.type === 'success') {
				logoFileName = '';
				signatureFileName = '';
				removeLogo = false;
				removeSignature = false;
				savedValues = currentValues();
				saveLabel = 'Saved';
				setTimeout(() => (saveLabel = 'Save Changes'), 1400);
			}
		};
	}}
>
	<div class="header">
		<a class="back" href="/settings">← Settings</a>
		<div class="title">Invoice Settings</div>
		<div class="helper">
			Printed on every GST invoice you issue. Changing these never alters invoices you've already
			issued. <a href="/invoices">View issued invoices</a>
		</div>
	</div>

	{#if hasGeneralError() && form && 'message' in form}
		<div class="form-error" role="alert">{form.message}</div>
	{/if}

	<Card>
		<div class="sections">
			<InvoiceSettingsForm
				bind:settings
				logoUrl={data.logoUrl}
				signatureUrl={data.signatureUrl}
				bind:logoFileName
				bind:signatureFileName
				bind:removeLogo
				bind:removeSignature
				{errorFor}
			/>
		</div>
	</Card>

	{#if dirty || saveLabel === 'Saved'}
		<div class="save-bar">
			<Button variant="primary" size="lg" type="submit">{saveLabel}</Button>
		</div>
	{/if}
</form>

<style>
	.invoice-settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 640px;
		margin-inline: auto;
	}

	.header {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.back {
		font-size: 13px;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(24px, 5vw, 32px);
		color: var(--text-primary);
	}

	.helper {
		font-size: 13px;
		color: var(--text-muted);
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}

	.save-bar {
		position: sticky;
		bottom: 16px;
		align-self: center;
		display: flex;
		filter: drop-shadow(0 6px 16px rgb(53 25 14 / 0.22));
		max-width: 100%;
		z-index: 10;
	}
</style>
