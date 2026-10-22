<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import { listCountries } from '$lib/countries';
	import { GENDER_SUGGESTIONS, type ClientProfile } from '$lib/clientProfile';

	// The details a client gives about themselves (all required, checked by
	// parseClientProfile). `named` = false leaves the inputs unnamed so a page can mirror
	// the values into several forms with ClientProfileHiddenInputs instead.
	// `error` is the server's complaint about one field (from parseClientProfile's
	// `field`), shown under that field.
	let {
		profile = $bindable(),
		named = true,
		error = null
	}: {
		profile: ClientProfile;
		named?: boolean;
		error?: { field: keyof ClientProfile; message: string } | null;
	} = $props();

	const countries = listCountries();

	function inputName(key: string): string | undefined {
		if (named) {
			return key;
		}
		return undefined;
	}

	// Editing a field hides its error. Each server response is a new `error` object,
	// so a failed resubmit clears this and the error shows again.
	let editedFields = $state<(keyof ClientProfile)[]>([]);
	$effect.pre(() => {
		void error;
		editedFields = [];
	});

	function markEdited(key: keyof ClientProfile) {
		if (!editedFields.includes(key)) {
			editedFields.push(key);
		}
	}

	function errorFor(key: keyof ClientProfile): string | undefined {
		if (error && error.field === key && !editedFields.includes(key)) {
			return error.message;
		}
		return undefined;
	}
</script>

<Input
	label="Date of birth"
	type="date"
	name={inputName('dateOfBirth')}
	error={errorFor('dateOfBirth')}
	oninput={() => markEdited('dateOfBirth')}
	bind:value={profile.dateOfBirth}
/>
<div class="gender-field">
	<Input
		label="Gender"
		name={inputName('gender')}
		placeholder="Type or pick one"
		list="client-gender-suggestions"
		error={errorFor('gender')}
		oninput={() => markEdited('gender')}
		bind:value={profile.gender}
	/>
</div>
<datalist id="client-gender-suggestions">
	{#each GENDER_SUGGESTIONS as suggestion (suggestion)}
		<option value={suggestion}></option>
	{/each}
</datalist>
<Input
	label="City / Town"
	name={inputName('city')}
	error={errorFor('city')}
	oninput={() => markEdited('city')}
	bind:value={profile.city}
/>
<Input
	label="State"
	name={inputName('state')}
	error={errorFor('state')}
	oninput={() => markEdited('state')}
	bind:value={profile.state}
/>
<label class="field">
	<span class="field-label">Country</span>
	<select
		class="field-input country-select"
		class:has-error={Boolean(errorFor('country'))}
		name={inputName('country')}
		aria-invalid={Boolean(errorFor('country'))}
		onchange={() => markEdited('country')}
		bind:value={profile.country}
	>
		<option value="" disabled>Choose a country</option>
		{#each countries as country (country.code)}
			<option value={country.code}>{country.name}</option>
		{/each}
	</select>
	{#if errorFor('country')}
		<span class="field-error" role="alert">{errorFor('country')}</span>
	{/if}
</label>

<style>
	/* Free text with suggestions, so hide Chrome's datalist arrow that makes it look like a select */
	.gender-field :global(input::-webkit-calendar-picker-indicator) {
		display: none !important;
	}

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
	}

	/* Same cap as the phone code picker (PhoneInput): a customizable select (Chrome
	   135+) keeps the open list from filling the screen; other browsers keep native. */
	.country-select,
	.country-select::picker(select) {
		appearance: base-select;
	}

	.country-select::picker(select) {
		max-height: 300px;
		overflow-y: auto;
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
	}

	.field-input.has-error {
		border-color: var(--accent-danger, #c0392b);
	}

	.field-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
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
