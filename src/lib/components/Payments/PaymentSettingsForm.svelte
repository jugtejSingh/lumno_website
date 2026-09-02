<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/utils/Card.svelte';
	import Switch from '$lib/components/utils/Switch.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import type { PackExhaustedAction } from '$lib/types/payments';

	let {
		packsEnabled: initialPacksEnabled,
		packExhaustedAction: initialPackExhaustedAction,
		packExhaustedActionOptions,
		hourOptions,
		freeChangeWindowHours,
		partialChangeWindowHours,
		message
	}: {
		packsEnabled: boolean;
		packExhaustedAction: PackExhaustedAction;
		packExhaustedActionOptions: PackExhaustedAction[];
		hourOptions: { hours: number; label: string }[];
		freeChangeWindowHours: number;
		partialChangeWindowHours: number | null;
		message?: string;
	} = $props();

	const hourLabels = hourOptions.map((o) => o.label);
	const hoursByLabel = new Map(hourOptions.map((o) => [o.label, o.hours]));
	const NO_PARTIAL_LABEL = 'No partial tier — straight to 100%';
	const partialLabels = [NO_PARTIAL_LABEL, ...hourLabels];

	function labelForHours(hours: number | null): string {
		if (hours === null) return NO_PARTIAL_LABEL;
		return hourOptions.find((o) => o.hours === hours)?.label ?? hourLabels[0];
	}

	let packsEnabled = $state(initialPacksEnabled);
	let packExhaustedAction = $state(initialPackExhaustedAction);
	let freeLabel = $state(labelForHours(freeChangeWindowHours));
	let partialLabel = $state(labelForHours(partialChangeWindowHours));

	const freeHours = $derived(hoursByLabel.get(freeLabel) ?? freeChangeWindowHours);
	const partialHours = $derived(partialLabel === NO_PARTIAL_LABEL ? '' : (hoursByLabel.get(partialLabel) ?? ''));
</script>

<Card>
	<div class="section-title">Pack & cancellation settings</div>
	<form
		class="settings-form"
		method="POST"
		action="?/updatePaymentSettings"
		use:enhance={() => {
			return async ({ update }) => update();
		}}
	>
		<Switch label="Enable pre-paid session packs" bind:checked={packsEnabled} />
		<input type="hidden" name="packsEnabled" value={packsEnabled} />

		<Select
			label="When a pack runs out"
			options={packExhaustedActionOptions}
			bind:value={packExhaustedAction}
			name="packExhaustedAction"
		/>

		<Select label="Free cancellation/reschedule window" options={hourLabels} bind:value={freeLabel} />
		<input type="hidden" name="freeChangeWindowHours" value={freeHours} />

		<Select label="50% fee window" options={partialLabels} bind:value={partialLabel} />
		<input type="hidden" name="partialChangeWindowHours" value={partialHours} />

		{#if message}
			<div class="form-error">{message}</div>
		{/if}

		<Button type="submit" variant="primary">Save settings</Button>
	</form>
</Card>

<style>
	.section-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.settings-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 360px;
		margin-top: 14px;
	}

	.form-error {
		font-size: 13px;
		color: var(--danger, #b3261e);
	}
</style>
