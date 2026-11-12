<script lang="ts">
	import Badge from '$lib/components/utils/Badge.svelte';
	import { formatInvoiceDate, formatRupees } from '$lib/invoice';

	export type InvoiceListItem = {
		id: string;
		number: string;
		issueDate: string;
		buyerName: string;
		totalPaise: number;
		status: 'issued' | 'cancelled';
	};

	// Shared by the therapist's history and the client portal; each row links to
	// `${hrefBase}/${id}`, where the invoice can be viewed and downloaded.
	let { rows, hrefBase }: { rows: InvoiceListItem[]; hrefBase: string } = $props();
</script>

<ul class="rows">
	{#each rows as row (row.id)}
		<li>
			<a href="{hrefBase}/{row.id}" class="row">
				<span class="number">{row.number}</span>
				<span class="date">{formatInvoiceDate(row.issueDate)}</span>
				<span class="buyer">{row.buyerName}</span>
				<span class="total">{formatRupees(row.totalPaise)}</span>
				<span class="status">
					{#if row.status === 'cancelled'}
						<Badge tone="danger">Cancelled</Badge>
					{/if}
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.row {
		display: grid;
		grid-template-columns: 11rem 7rem minmax(0, 1fr) 7rem 6rem;
		gap: 12px;
		align-items: center;
		padding: 10px 4px;
		color: var(--text-primary);
		text-decoration: none;
		border-bottom: 1px solid var(--border, #e5e5e5);
	}

	li:last-child .row {
		border-bottom: none;
	}

	.number {
		font-weight: 700;
	}

	.date,
	.buyer {
		color: var(--text-secondary);
		overflow-wrap: anywhere;
	}

	.total {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 720px) {
		.row {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.date,
		.buyer {
			grid-column: 1;
		}
	}
</style>
