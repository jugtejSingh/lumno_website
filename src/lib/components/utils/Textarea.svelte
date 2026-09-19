<script lang="ts">
	import InfoTip from './InfoTip.svelte';
	let {
		label,
		info,
		placeholder,
		rows = 3,
		name,
		value = $bindable('')
	}: {
		label?: string;
		// explanation behind an "i" button next to the label
		info?: string;
		placeholder?: string;
		rows?: number;
		name?: string;
		value?: string;
	} = $props();
</script>

<label class="field">
	{#if label}
		<span class="field-label">{label}{#if info}<InfoTip text={info} {label} />{/if}</span>
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
		resize: vertical;
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
