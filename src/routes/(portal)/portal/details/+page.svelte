<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import ClientProfileFields from '$lib/components/Clients/ClientProfileFields.svelte';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// seeded from the load data only, like every other draft in this app
	let phone = $state(data.clientPhone);
	let timezone = $state(data.clientTimezone);
	let profile = $state(structuredClone(data.clientProfile));
</script>

<div class="section">
	<div class="section-title">Your details</div>
	<Card>
		<form class="details-form" method="POST" action="?/saveDetails" use:enhance>
			<Input
				label="Phone"
				name="phone"
				type="tel"
				placeholder="+910000000000"
				bind:value={phone}
			/>
			<div class="hint">
				Optional. Give us a number and session reminders come by WhatsApp instead of email.
			</div>
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
	</Card>
	<Card>
		<form class="details-form" method="POST" action="?/saveProfile" use:enhance>
			<div class="hint">{data.therapistName} can see these details.</div>
			<ClientProfileFields bind:profile />
			{#if form && 'profileMessage' in form && form.profileMessage}
				<div class="form-error">{form.profileMessage}</div>
			{/if}
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

	.form-error {
		font-size: 13px;
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
