<script lang="ts">
	import InfoTip from './InfoTip.svelte';
	type Type = 'text' | 'email' | 'password' | 'date' | 'tel';

	let {
		label,
		info,
		placeholder,
		type = 'text',
		name,
		value = $bindable(''),
		onkeydown,
		error
	}: {
		label?: string;
		// explanation behind an "i" button next to the label
		info?: string;
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
		<span class="field-label">{label}{#if info}<InfoTip text={info} {label} />{/if}</span>
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
		font-weight: 700;
		color: var(--text-secondary);
	}

	.field-input {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-inset);
		padding: 10px 12px;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--outline);
		background: var(--coral-100);
		box-shadow: var(--shadow-focus);
	}

	/* 16px stops iOS zooming the page in when the field takes focus */
	@media (max-width: 520px) {
		.field-input {
			font-size: 16px;
		}
	}
</style>
