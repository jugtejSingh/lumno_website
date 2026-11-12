<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { MAX_EXTRA_FIELDS, type InvoiceExtraField } from '$lib/invoiceValidation';

	// Posted as parallel extraFieldLabel / extraFieldValue lists (parseExtraFields).
	// Shared by invoice settings and client billing.
	let {
		fields = $bindable([]),
		error = ''
	}: {
		fields?: InvoiceExtraField[];
		error?: string;
	} = $props();

	const atLimit = $derived(fields.length >= MAX_EXTRA_FIELDS);

	function addField() {
		if (atLimit) {
			return;
		}
		fields = [...fields, { label: '', value: '' }];
	}

	function removeField(index: number) {
		const next = [...fields];
		next.splice(index, 1);
		fields = next;
	}
</script>

<div class="extra-fields">
	{#each fields as field, index (index)}
		<div class="extra-row">
			<div class="extra-input">
				<Input name="extraFieldLabel" placeholder="Label, e.g. PAN" bind:value={field.label} />
			</div>
			<div class="extra-input">
				<Input name="extraFieldValue" placeholder="Value" bind:value={field.value} />
			</div>
			<button
				type="button"
				class="icon-btn"
				aria-label="Remove {field.label || 'field'}"
				onclick={() => removeField(index)}>✕</button
			>
		</div>
	{/each}

	{#if error}
		<span class="field-error" role="alert">{error}</span>
	{/if}

	{#if atLimit}
		<div class="helper">You've reached the limit of {MAX_EXTRA_FIELDS} extra fields.</div>
	{:else}
		<div>
			<Button variant="secondary" size="sm" onclick={addField}>Add field</Button>
		</div>
	{/if}
</div>

<style>
	.extra-fields {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.extra-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.extra-input {
		flex: 1;
		min-width: 0;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-secondary);
		font-size: 14px;
		cursor: pointer;
	}

	.helper {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.field-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}
</style>
