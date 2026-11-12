<script lang="ts">
	import Button from '$lib/components/utils/Button.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import InvoiceDocument from '$lib/components/Invoices/InvoiceDocument.svelte';
	import InvoiceEmailForm from '$lib/components/Invoices/InvoiceEmailForm.svelte';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let confirming = $state(false);
</script>

<svelte:head>
	<title>Invoice {data.invoice.number} — Lumno</title>
</svelte:head>

<div class="invoice-view">
	<header>
		<div class="title">
			<h1>Invoice {data.invoice.number}</h1>
			{#if data.invoice.status === 'cancelled'}
				<Badge tone="danger">Cancelled</Badge>
			{/if}
		</div>
		<div class="actions">
			<Button variant="secondary" size="sm" href="/invoices">All invoices</Button>
			<Button variant="secondary" size="sm" onclick={() => window.print()}>Download</Button>
			{#if data.invoice.status === 'issued'}
				{#if confirming}
					<form
						method="POST"
						action="?/cancel"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								confirming = false;
							};
						}}
					>
						<span class="confirm-text">Cancel this invoice? Its number stays used.</span>
						<Button variant="secondary" size="sm" onclick={() => (confirming = false)}>Keep</Button>
						<Button type="submit" size="sm">Cancel invoice</Button>
					</form>
				{:else}
					<Button variant="secondary" size="sm" onclick={() => (confirming = true)}>Cancel invoice</Button>
				{/if}
			{/if}
		</div>
	</header>
	{#if form?.message}
		<p class="form-error" role="alert">{form.message}</p>
	{/if}
	{#if data.invoice.status === 'issued'}
		<InvoiceEmailForm
			defaultTo={data.defaultRecipient}
			sentTo={data.invoice.sentTo}
			sentAt={data.invoice.sentAt}
			error={form?.emailError}
			emailedTo={form?.emailedTo}
		/>
	{/if}
	<div class="document">
		<InvoiceDocument
			invoice={data.invoice.data}
			logoUrl={data.images.logoUrl}
			signatureUrl={data.images.signatureUrl}
			cancelled={data.invoice.status === 'cancelled'}
		/>
	</div>
</div>

<style>
	.invoice-view {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
	}

	.title {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.actions,
	form {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}

	.confirm-text {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.form-error {
		margin: 0;
		color: var(--danger, #b3261e);
		font-size: 13px;
	}

	.document {
		display: flex;
		justify-content: center;
	}
</style>
