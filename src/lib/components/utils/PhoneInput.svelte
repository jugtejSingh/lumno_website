<script lang="ts">
	import { countryForPhone, listDialCountries } from '$lib/countries';

	// A country code picker plus the local number, joined into one E.164 string
	// (+919810012345) in `value`, which is what parsePhone validates and the DB stores.
	// With `name`, that string is also posted as a hidden input.
	let {
		label = 'Phone',
		name,
		// small text between the label and the inputs
		hint,
		error,
		oninput,
		value = $bindable('')
	}: {
		label?: string;
		name?: string;
		hint?: string;
		error?: string;
		// fires whenever the client changes the code or the number
		oninput?: () => void;
		value?: string;
	} = $props();

	// Every country and territory, India first. The picker's value is the ISO country,
	// not the dialling code, because several places share one (+1, +44, ...).
	// '' is "Other", which takes the full +number as typed.
	const DIAL_COUNTRIES = listDialCountries();

	function dialCodeOf(country: string): string {
		for (const entry of DIAL_COUNTRIES) {
			if (entry.country === country) {
				return entry.dialCode;
			}
		}
		return '';
	}

	// Splits a stored number back into picker + local part. A shared code shows as its
	// main country (+1 as the US); the number posted is the same either way.
	function split(full: string): { country: string; number: string } {
		if (!full) {
			return { country: 'IN', number: '' };
		}
		const match = countryForPhone(full);
		if (match) {
			return { country: match.country, number: full.slice(match.dialCode.length) };
		}
		return { country: '', number: full };
	}

	// Spaces, dashes and brackets are dropped, and so is a leading trunk 0
	// (09810012345 -> 9810012345), the most common way a local number is typed.
	function join(code: string, number: string): string {
		const trimmed = number.trim();
		if (!trimmed) {
			return '';
		}
		if (!code) {
			return trimmed.replace(/[\s\-()]/g, '');
		}
		const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
		return code + digits;
	}

	// seeded once from the incoming value, like every other draft in this app
	const initial = split(value);
	let country = $state(initial.country);
	let number = $state(initial.number);
	const code = $derived(dialCodeOf(country));

	function sync() {
		value = join(code, number);
		if (oninput) {
			oninput();
		}
	}

	let placeholder = $derived.by(() => {
		if (code) {
			return '9810012345';
		}
		return '+4915123456789';
	});
</script>

<div class="field">
	<span class="field-label">{label}</span>
	{#if hint}
		<span class="field-hint">{hint}</span>
	{/if}
	<div class="row">
		<select class="field-input code" aria-label="Country code" bind:value={country} onchange={sync}>
			{#each DIAL_COUNTRIES as entry (entry.country)}
				<option value={entry.country}>{entry.name} {entry.dialCode}</option>
			{/each}
			<option value="">Other</option>
		</select>
		<input
			class="field-input number"
			class:has-error={Boolean(error)}
			type="tel"
			aria-label="Phone number"
			aria-invalid={Boolean(error)}
			autocomplete="tel-national"
			{placeholder}
			bind:value={number}
			oninput={sync}
		/>
	</div>
	{#if error}
		<span class="field-error" role="alert">{error}</span>
	{/if}
	{#if name}
		<input type="hidden" {name} {value} />
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}

	.field-label {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.field-hint {
		font-size: 12px;
		color: var(--text-muted);
	}

	.field-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}

	.field-input.has-error {
		border-color: var(--accent-danger, #c0392b);
	}

	.row {
		display: flex;
		gap: 8px;
	}

	.field-input {
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

	/* a select is as wide as its longest option; cap it so the number keeps room */
	.code {
		flex: 0 1 auto;
		max-width: 45%;
	}

	/* 249 options would fill the screen. A customizable select (Chrome 135+) lets the
	   open list be capped and scroll; other browsers ignore this and keep the native one. */
	.code,
	.code::picker(select) {
		appearance: base-select;
	}

	.code::picker(select) {
		max-height: 300px;
		overflow-y: auto;
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
	}

	.number {
		flex: 1;
		min-width: 0;
	}
</style>
