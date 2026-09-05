<script lang="ts">
	type Type = 'text' | 'email' | 'password' | 'date';

	let {
		label,
		placeholder,
		type = 'text',
		name,
		value = $bindable(''),
		onkeydown,
		error
	}: {
		label?: string;
		placeholder?: string;
		type?: Type;
		name?: string;
		value?: string;
		onkeydown?: (e: KeyboardEvent) => void;
		error?: string;
	} = $props();
</script>

<label class="field">
	{#if label}
		<span class="field-label">{label}</span>
	{/if}
	<input class="field-input" {type} {name} {placeholder} bind:value {onkeydown} />
	{#if error}
		<span class="field-error">{error}</span>
	{/if}
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-error {
		font-size: 12px;
		color: var(--accent-danger, #c0392b);
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
	}

	.field-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: var(--shadow-focus);
	}
</style>
