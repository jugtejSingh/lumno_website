<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import PhoneInput from '$lib/components/utils/PhoneInput.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import ClientProfileFields from '$lib/components/Clients/ClientProfileFields.svelte';
	import PhoneVerification from '$lib/components/Clients/PhoneVerification.svelte';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// seeded from the load data only, like every other draft in this app. A pending
	// number is what the client last typed, so the field shows that over the verified one.
	let phone = $state(data.pendingPhone || data.clientPhone);
	let timezone = $state(data.clientTimezone);
	let profile = $state(structuredClone(data.clientProfile));

	// saveProfile tags its failure with the field it belongs to, shown under that field
	const profileError = $derived.by(() => {
		if (form && 'profileField' in form && form.profileField && form.profileMessage) {
			return { field: form.profileField, message: form.profileMessage };
		}
		return null;
	});
</script>

<div class="section">
	<div class="section-title">Your details</div>
	<Card>
		<form class="details-form" method="POST" action="?/saveDetails" use:enhance>
			<PhoneInput name="phone" bind:value={phone} />
			<div class="hint">
				Optional. Add and verify a WhatsApp number and your reminders come there instead of email.
			</div>
			{#if phone && phone !== data.clientPhone && phone !== data.pendingPhone}
				<div class="hint">Save to verify this number on WhatsApp.</div>
			{/if}
			{#if form && 'message' in form && form.message}
				<div class="form-error">{form.message}</div>
			{/if}
			<label class="field">
				<span class="field-label">Timezone</span>
				<select class="field-input" name="timezone" bind:value={timezone}>
					<option value="">Same as {data.therapistName} ({data.therapistTimezone})</option>
					{#each data.timezoneOptions as tz (tz)}
						<option value={tz}>{tz}</option>
					{/each}
				</select>
			</label>
			<div class="hint">Session times show in this timezone.</div>
			<Button type="submit" variant="primary" size="sm">Save</Button>
		</form>
		<!-- outside the details form: forms can't nest -->
		{#if data.clientPhone || data.pendingPhone}
			<div class="verify-block">
				{#if data.clientPhone}
					<div class="phone-status">
						<span>{data.clientPhone}</span>
						<Badge tone="success">Verified on WhatsApp</Badge>
					</div>
				{/if}
				{#if data.pendingPhone}
					<div class="hint">
						{data.pendingPhone} isn't verified yet.
						{#if data.clientPhone}
							Reminders keep going to {data.clientPhone} until it is.
						{:else}
							Reminders come by email until it is.
						{/if}
					</div>
					{#key data.pendingPhone}
						<PhoneVerification phone={data.pendingPhone} />
					{/key}
				{/if}
			</div>
		{/if}
	</Card>
	<Card>
		<form class="details-form" method="POST" action="?/saveProfile" use:enhance>
			<div class="hint">{data.therapistName} can see these details.</div>
			<ClientProfileFields bind:profile error={profileError} />
			<Button type="submit" variant="primary" size="sm">Save</Button>
		</form>
	</Card>
</div>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 760px;
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	.verify-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 12px;
	}

	.phone-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--text-primary);
	}

	.form-error {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}

	.details-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
		max-width: 320px;
	}

	/* align-items: flex-start keeps Save from stretching, so the field needs its width back */
	.details-form > :global(.field) {
		width: 100%;
	}

	/* raw <select> here (not the Select component) because the "same as therapist"
	   option needs a label distinct from its value — Select assumes value === label */
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
</style>
