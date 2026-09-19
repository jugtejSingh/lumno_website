<script lang="ts">
	import InfoTip from './InfoTip.svelte';
	let {
		label,
		info,
		options,
		value = $bindable(''),
		name,
		onchange
	}: {
		label?: string;
		// explanation behind an "i" button next to the label
		info?: string;
		options: string[];
		value?: string;
		name?: string;
		onchange?: (e: Event) => void;
	} = $props();
</script>

<label class="field">
	{#if label}
		<span class="field-label">{label}{#if info}<InfoTip text={info} {label} />{/if}</span>
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
		text-transform: capitalize;
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
