<script lang="ts">
	// A country code picker plus the local number, joined into one E.164 string
	// (+919810012345) in `value`, which is what parsePhone validates and the DB stores.
	// With `name`, that string is also posted as a hidden input.
	let {
		label = 'Phone',
		name,
		value = $bindable('')
	}: { label?: string; name?: string; value?: string } = $props();

	// ponytail: hand-picked list, India first. "Other" takes the full +number for
	// anywhere else; swap in a full list if clients outside these start showing up.
	const COUNTRIES = [
		{ code: '+91', label: 'India +91' },
		{ code: '+44', label: 'UK +44' },
		{ code: '+1', label: 'US/Canada +1' },
		{ code: '+971', label: 'UAE +971' },
		{ code: '+65', label: 'Singapore +65' },
		{ code: '+61', label: 'Australia +61' },
		{ code: '', label: 'Other' }
	];

	// Splits a stored number back into picker + local part. Codes are tried longest
	// first so +971 isn't read as +9.
	function split(full: string): { code: string; number: string } {
		if (!full) {
			return { code: '+91', number: '' };
		}
		const byLength = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
		for (const country of byLength) {
			if (country.code && full.startsWith(country.code)) {
				return { code: country.code, number: full.slice(country.code.length) };
			}
		}
		return { code: '', number: full };
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
	let code = $state(initial.code);
	let number = $state(initial.number);

	function sync() {
		value = join(code, number);
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
	<div class="row">
		<select class="field-input code" aria-label="Country code" bind:value={code} onchange={sync}>
			{#each COUNTRIES as country (country.label)}
				<option value={country.code}>{country.label}</option>
			{/each}
		</select>
		<input
			class="field-input number"
			type="tel"
			aria-label="Phone number"
			autocomplete="tel-national"
			{placeholder}
			bind:value={number}
			oninput={sync}
		/>
	</div>
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

	.code {
		flex: 0 0 auto;
	}

	.number {
		flex: 1;
		min-width: 0;
	}
</style>
