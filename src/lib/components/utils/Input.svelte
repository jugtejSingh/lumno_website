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
		oninput,
		error,
		list
	}: {
		label?: string;
		// explanation behind an "i" button next to the label
		info?: string;
		placeholder?: string;
		type?: Type;
		name?: string;
		value?: string;
		onkeydown?: (e: KeyboardEvent) => void;
		oninput?: (e: Event) => void;
		error?: string;
		// id of a <datalist> offering suggestions
		list?: string;
	} = $props();
</script>

<label class="field">
	{#if label}
		<span class="field-label">{label}{#if info}<InfoTip text={info} {label} />{/if}</span>
	{/if}
	<input
		class="field-input"
		class:has-error={Boolean(error)}
		{type}
		{name}
		{placeholder}
		{list}
		aria-invalid={Boolean(error)}
		bind:value
		{onkeydown}
		{oninput}
	/>
	{#if error}
		<span class="field-error" role="alert">{error}</span>
	{/if}
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}

	.field-input.has-error {
		border-color: var(--accent-danger, #c0392b);
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
