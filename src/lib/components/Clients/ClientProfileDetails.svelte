<script lang="ts">
	import { ageFromDateOfBirth } from '$lib/clientProfile';
	import { countryName } from '$lib/countries';

	// What the client told us about themselves when they accepted the invite.
	// Read-only for the therapist — the client edits these from their portal.
	let {
		phone,
		dateOfBirth,
		gender,
		city,
		state,
		country
	}: {
		phone: string | null;
		dateOfBirth: string | null;
		gender: string | null;
		city: string | null;
		state: string | null;
		country: string | null;
	} = $props();

	const hasAny = $derived(Boolean(phone || dateOfBirth || gender || city || state || country));

	const location = $derived.by(() => {
		const parts: string[] = [];
		if (city) {
			parts.push(city);
		}
		if (state) {
			parts.push(state);
		}
		if (country) {
			parts.push(countryName(country));
		}
		return parts.join(', ');
	});
</script>

<div class="details">
	<div class="details-title">From the client</div>
	{#if hasAny}
		<dl>
			{#if phone}
				<dt>Phone</dt>
				<dd>{phone}</dd>
			{/if}
			{#if dateOfBirth}
				<dt>Date of birth</dt>
				<dd>{dateOfBirth} ({ageFromDateOfBirth(dateOfBirth)} years)</dd>
			{/if}
			{#if gender}
				<dt>Gender</dt>
				<dd>{gender}</dd>
			{/if}
			{#if location}
				<dt>Location</dt>
				<dd>{location}</dd>
			{/if}
		</dl>
	{:else}
		<div class="empty">Not provided yet. The client fills these in from their portal.</div>
	{/if}
</div>

<style>
	.details {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
	}

	.details-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 12px;
		margin: 0;
		font-size: 14px;
	}

	dt {
		color: var(--text-secondary);
	}

	dd {
		margin: 0;
		color: var(--text-primary);
	}

	.empty {
		font-size: 13px;
		color: var(--text-secondary);
	}
</style>
