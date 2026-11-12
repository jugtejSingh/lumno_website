<!-- styles inlined into server-rendered HTML for the emailed PDF (invoicePdf.ts) -->
<svelte:options css="injected" />

<script lang="ts">
	import { stateName, type InvoiceParty } from '$lib/invoice';

	let { seller, buyer }: { seller: InvoiceParty; buyer: InvoiceParty } = $props();

	// same fallback as placeOfSupply in $lib/invoice: no buyer state → the seller's
	const supplyState = $derived.by(() => {
		if (buyer.stateCode !== '') {
			return buyer.stateCode;
		}
		return seller.stateCode;
	});
</script>

{#snippet party(heading: string, details: InvoiceParty)}
	<div class="party">
		<div class="heading">{heading}</div>
		<div class="name">{details.name || '—'}</div>
		{#if details.address}
			<div class="address">{details.address}</div>
		{/if}
		{#if details.gstin}
			<div>GSTIN: {details.gstin}</div>
		{/if}
		{#if details.stateCode}
			<div>State: {stateName(details.stateCode)} ({details.stateCode})</div>
		{/if}
		{#each details.extraFields ?? [] as field, index (index)}
			<div>{field.label}: {field.value}</div>
		{/each}
	</div>
{/snippet}

<section class="parties">
	{@render party('From', seller)}
	{@render party('Bill to', buyer)}
</section>

<div class="supply">
	<span class="heading">Place of supply</span>
	{#if supplyState}
		{stateName(supplyState)} ({supplyState})
	{:else}
		—
	{/if}
</div>

<style>
	.parties {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		padding: 16px 0 12px;
	}

	.party {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.heading {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--invoice-muted);
	}

	.name {
		font-weight: 700;
		font-size: 15px;
	}

	.address {
		white-space: pre-line;
	}

	.supply {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding-bottom: 14px;
	}
</style>
