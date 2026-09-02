<script lang="ts">
	let {
		label,
		placeholder,
		rows = 3,
		name,
		value = $bindable('')
	}: {
		label?: string;
		placeholder?: string;
		rows?: number;
		name?: string;
		value?: string;
	} = $props();
</script>

<label class="field">
	{#if label}
		<span class="field-label">{label}</span>
	{/if}
	<textarea class="field-input" {placeholder} {rows} {name} bind:value></textarea>
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.field-input {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		resize: vertical;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: var(--shadow-focus);
	}
</style>
