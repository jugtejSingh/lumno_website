<script lang="ts">
	import { goto } from '$app/navigation';
	import Card from '$lib/components/utils/Card.svelte';
	import Pager from '$lib/components/utils/Pager.svelte';
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
			<p class="empty">
				No invoices yet. Issue one from a payment on a client's Payments tab.
			</p>
		{:else}
			<InvoiceList rows={data.invoices} hrefBase="/invoice" />
		{/if}
	</Card>
	<Pager
		page={data.page}
		totalPages={data.totalPages}
		ongoto={(target) => goto(`?page=${target}`)}
	/>
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
