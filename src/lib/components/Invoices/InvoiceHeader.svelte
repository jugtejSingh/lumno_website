<script lang="ts">
	import { formatInvoiceDate } from '$lib/invoice';

	let { title, number, date }: { title: string; number: string; date: string } = $props();
</script>

<header class="header">
	<h2 class="title">{title}</h2>
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
