<!-- styles inlined into server-rendered HTML for the emailed PDF (invoicePdf.ts) -->
<svelte:options css="injected" />

<script lang="ts">
	import { formatInvoiceDate } from '$lib/invoice';

	let {
		title,
		number,
		date,
		logoUrl = null
	}: { title: string; number: string; date: string; logoUrl?: string | null } = $props();
</script>

<header class="header">
	<div class="brand">
		{#if logoUrl}
			<img class="logo" src={logoUrl} alt="Logo" />
		{/if}
		<h2 class="title">{title}</h2>
	</div>
	<dl class="meta">
		<div>
			<dt>Invoice no.</dt>
			<dd>{number || '—'}</dd>
		</div>
		<div>
			<dt>Date</dt>
			<dd>{formatInvoiceDate(date) || '—'}</dd>
		</div>
	</dl>
</header>

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		padding-bottom: 14px;
		border-bottom: 2px solid var(--invoice-ink);
	}

	.brand {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}

	.logo {
		display: block;
		max-width: 160px;
		max-height: 56px;
		object-fit: contain;
		object-position: left center;
	}

	.title {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.meta {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: right;
	}

	.meta div {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	dt {
		color: var(--invoice-muted);
	}

	dd {
		margin: 0;
		font-weight: 700;
	}
</style>
