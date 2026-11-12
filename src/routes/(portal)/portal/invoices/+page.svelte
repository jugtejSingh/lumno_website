<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import InvoiceList from '$lib/components/Invoices/InvoiceList.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Invoices — Lumno</title>
</svelte:head>

<div class="invoices">
	<h1>Invoices</h1>
	<Card>
		{#if data.invoices.length === 0}
			<p class="empty">No invoices yet. They appear here once {data.therapistName} issues one.</p>
		{:else}
			<InvoiceList rows={data.invoices} hrefBase="/portal/invoices" />
		{/if}
	</Card>
</div>

<style>
	.invoices {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 20px;
		color: var(--text-primary);
	}

	.empty {
		margin: 0;
		color: var(--text-secondary);
	}
</style>
