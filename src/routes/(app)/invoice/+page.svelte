<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Card from '$lib/components/utils/Card.svelte';
	import InvoiceForm from '$lib/components/Invoices/InvoiceForm.svelte';
	import InvoiceDocument from '$lib/components/Invoices/InvoiceDocument.svelte';
	import { enhance } from '$lib/enhance';
	import { emptyInvoice } from '$lib/invoice';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// seeded once; a failed issue keeps what's on screen
	let invoice = $state(
		structuredClone(
			untrack(() => {
				if (data.needsSettings) {
					return emptyInvoice('');
				}
				return data.draft;
			})
		)
	);
</script>

<svelte:head>
	<title>Issue Invoice — Lumno</title>
</svelte:head>

{#if data.needsSettings}
	<Card>
		<div class="setup">
			<h1>Set up invoices first</h1>
			<p>Add your legal name, address and state, and how invoices are numbered.</p>
			<Button href="/settings/invoices">Invoice settings</Button>
		</div>
	</Card>
{:else}
	<div class="invoice-page">
		<div class="editor">
			<h1>Issue invoice</h1>
			<form
				method="POST"
				action="?/issue"
				use:enhance={() => {
					return async ({ update }) => {
						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="paymentId" value={data.paymentId} />
				<input type="hidden" name="invoice" value={JSON.stringify(invoice)} />
				<InvoiceForm bind:invoice />
				{#if form?.message}
					<p class="error" role="alert">{form.message}</p>
				{/if}
				<div class="actions">
					<Button type="submit">Issue invoice</Button>
				</div>
			</form>
		</div>
		<div class="preview">
			<InvoiceDocument {invoice} />
		</div>
	</div>
{/if}

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

	.setup {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}

	.setup h1,
	.setup p {
		margin: 0;
	}

	.error {
		margin: 16px 0 0;
		color: var(--danger, #b42318);
		font-size: 14px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 16px;
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
