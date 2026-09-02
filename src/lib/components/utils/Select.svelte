<script lang="ts">
	let {
		label,
		options,
		value = $bindable(''),
		name,
		onchange
	}: {
		label?: string;
		options: string[];
		value?: string;
		name?: string;
		onchange?: (e: Event) => void;
	} = $props();
</script>

<label class="field">
	{#if label}
		<span class="field-label">{label}</span>
	{/if}
	<select class="field-input" {name} bind:value {onchange}>
		{#each options as option (option)}
			<option value={option}>{option}</option>
		{/each}
	</select>
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
	}

	.field-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: var(--shadow-focus);
	}
</style>
