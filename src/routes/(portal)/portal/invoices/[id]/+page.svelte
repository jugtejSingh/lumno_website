<script lang="ts">
	import Button from '$lib/components/utils/Button.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import InvoiceDocument from '$lib/components/Invoices/InvoiceDocument.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
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
			<Button variant="secondary" size="sm" href="/portal/invoices">All invoices</Button>
			<Button variant="secondary" size="sm" onclick={() => window.print()}>Download</Button>
		</div>
	</header>
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

	.actions {
		display: flex;
		gap: 8px;
	}

	.document {
		display: flex;
		justify-content: center;
	}
</style>
