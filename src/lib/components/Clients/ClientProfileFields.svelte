<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import { listCountries } from '$lib/countries';
	import { GENDER_SUGGESTIONS, type ClientProfile } from '$lib/clientProfile';

	// The details a client gives about themselves (all required, checked by
	// parseClientProfile). `named` = false leaves the inputs unnamed so a page can mirror
	// the values into several forms with ClientProfileHiddenInputs instead.
	let {
		profile = $bindable(),
		named = true
	}: {
		profile: ClientProfile;
		named?: boolean;
	} = $props();

	const countries = listCountries();

	function inputName(key: string): string | undefined {
		if (named) {
			return key;
		}
		return undefined;
	}
</script>

<Input label="Date of birth" type="date" name={inputName('dateOfBirth')} bind:value={profile.dateOfBirth} />
<Input
	label="Gender"
	name={inputName('gender')}
	placeholder="Type or pick one"
	list="client-gender-suggestions"
	bind:value={profile.gender}
/>
<datalist id="client-gender-suggestions">
	{#each GENDER_SUGGESTIONS as suggestion (suggestion)}
		<option value={suggestion}></option>
	{/each}
</datalist>
<Input label="City / Town" name={inputName('city')} bind:value={profile.city} />
<Input label="State" name={inputName('state')} bind:value={profile.state} />
<label class="field">
	<span class="field-label">Country</span>
	<select class="field-input" name={inputName('country')} bind:value={profile.country}>
		<option value="" disabled>Choose a country</option>
		{#each countries as country (country.code)}
			<option value={country.code}>{country.name}</option>
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
