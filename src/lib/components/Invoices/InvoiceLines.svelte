<!-- styles inlined into server-rendered HTML for the emailed PDF (invoicePdf.ts) -->
<svelte:options css="injected" />

<script lang="ts">
	import { formatRupees, type ComputedLine, type TaxType } from '$lib/invoice';

	let { lines, taxType }: { lines: ComputedLine[]; taxType: TaxType } = $props();
</script>

<div class="scroll">
	<table>
		<thead>
			<tr>
				<th class="num">#</th>
				<th>Description</th>
				<th>SAC</th>
				{#if taxType !== 'none'}
					<th class="money">Taxable value</th>
					<th class="money">Rate</th>
				{/if}
				{#if taxType === 'cgst_sgst'}
					<th class="money">CGST</th>
					<th class="money">SGST</th>
				{/if}
				{#if taxType === 'igst'}
					<th class="money">IGST</th>
				{/if}
				<th class="money">Amount</th>
			</tr>
		</thead>
		<tbody>
			{#each lines as line, index (line.id)}
				<tr>
					<td class="num">{index + 1}</td>
					<td class="description">{line.description || '—'}</td>
					<td>{line.sacCode}</td>
					{#if taxType !== 'none'}
						<td class="money">{formatRupees(line.taxablePaise)}</td>
						<td class="money">{line.gstRate}%</td>
					{/if}
					{#if taxType === 'cgst_sgst'}
						<td class="money">{formatRupees(line.cgstPaise)}</td>
						<td class="money">{formatRupees(line.sgstPaise)}</td>
					{/if}
					{#if taxType === 'igst'}
						<td class="money">{formatRupees(line.igstPaise)}</td>
					{/if}
					<td class="money">{formatRupees(line.totalPaise)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	th {
		text-align: left;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--invoice-muted);
		background: var(--invoice-shade);
		padding: 8px 6px;
		border-top: 1px solid var(--invoice-rule);
		border-bottom: 1px solid var(--invoice-rule);
		white-space: nowrap;
	}

	td {
		padding: 8px 6px;
		border-bottom: 1px solid var(--invoice-rule);
		vertical-align: top;
	}

	.num {
		width: 24px;
	}

	.description {
		overflow-wrap: anywhere;
	}

	.money {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
</style>
