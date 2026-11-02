<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { emptyLine, type InvoiceLine } from '$lib/invoice';

	let { lines = $bindable() }: { lines: InvoiceLine[] } = $props();

	function addLine() {
		lines.push(emptyLine());
	}

	function removeLine(id: string) {
		const index = lines.findIndex((line) => line.id === id);
		if (index !== -1) {
			lines.splice(index, 1);
		}
	}
</script>

<fieldset class="lines">
	<legend>Line items</legend>
	{#each lines as line, index (line.id)}
		<div class="line">
			<div class="line-head">
				<span class="line-number">Item {index + 1}</span>
				<Button variant="secondary" size="sm" disabled={lines.length === 1} onclick={() => removeLine(line.id)}>
					Remove
				</Button>
			</div>
			<Input label="Description" placeholder="Therapy session — 12 Oct 2026" bind:value={line.description} />
			<div class="row">
				<Input label="SAC" bind:value={line.sacCode} />
				<Input label="Amount (incl. GST)" placeholder="0" bind:value={line.amount} />
				<Input label="GST %" bind:value={line.gstRate} />
			</div>
		</div>
	{/each}
	<div>
		<Button variant="secondary" size="sm" onclick={addLine}>+ Add line</Button>
	</div>
</fieldset>

<style>
	.lines {
		display: flex;
		flex-direction: column;
		gap: 12px;
		border: none;
		margin: 0;
		padding: 0;
	}

	legend {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 16px;
		color: var(--text-primary);
		margin-bottom: 12px;
		padding: 0;
	}

	.line {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		border: 2px dashed var(--border-subtle);
		border-radius: var(--radius-sm);
	}

	.line-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.line-number {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1.4fr 0.8fr;
		gap: 10px;
	}

	@media (max-width: 520px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
