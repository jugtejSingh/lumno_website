<script lang="ts">
	import { enhance } from '$lib/enhance';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import type { AvailableSlot } from '$lib/server/availability';

	let {
		day,
		year,
		month,
		slots,
		message,
		onbooked,
		onclose
	}: {
		day: number | null;
		year: number;
		month: number;
		slots: AvailableSlot[];
		message?: string;
		onbooked: () => void;
		onclose: () => void;
	} = $props();

	const title = $derived(
		day !== null
			? new Date(year, month, day).toLocaleDateString('en-US', {
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				})
			: ''
	);

	const isHybrid = $derived(slots.length > 0 && slots[0].modality === 'hybrid');

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let notes = $state('');
	let startTime = $state('');
	let chosenModality = $state<'online' | 'in_person'>('online');

	// a different day has different slots, so drop a time picked on the previous one
	$effect(() => {
		if (day !== null) {
			startTime = '';
		}
	});
</script>

<Dialog open={day !== null} {title} {onclose}>
	<form
		method="POST"
		action="?/bookDiscoveryCall"
		class="call-form"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					onbooked();
				}
				await update({ reset: false });
			};
		}}
	>
		<input type="hidden" name="year" value={year} />
		<input type="hidden" name="month" value={month} />
		<input type="hidden" name="day" value={day} />
		<input type="hidden" name="startTime" value={startTime} />
		{#if isHybrid}
			<input type="hidden" name="modality" value={chosenModality} />
		{/if}

		{#if slots.length === 0}
			<div class="empty">No open times left on this day.</div>
		{/if}

		{#if isHybrid}
			<div class="modality-picker">
				<span class="field-label">Online or in-person?</span>
				<label>
					<input type="radio" value="online" bind:group={chosenModality} />
					Online
				</label>
				<label>
					<input type="radio" value="in_person" bind:group={chosenModality} />
					In-Person
				</label>
			</div>
		{:else if slots.length > 0}
			<div class="modality-note">
				{slots[0].modality === 'online' ? 'This is an online day.' : 'This is an in-person day.'}
			</div>
		{/if}

		<div class="slot-grid" role="radiogroup" aria-label="Time">
			{#each slots as slot (slot.startTime)}
				<button
					type="button"
					class="slot-btn"
					class:chosen={startTime === slot.startTime}
					role="radio"
					aria-checked={startTime === slot.startTime}
					onclick={() => (startTime = slot.startTime)}
				>
					{slot.label}
				</button>
			{/each}
		</div>

		<Input label="Your name" name="name" bind:value={name} />
		<Input label="Email" type="email" name="email" bind:value={email} info="Your confirmation and call link are sent here." />
		<Input label="Phone (optional)" type="tel" name="phone" placeholder="+910000000000" bind:value={phone} />
		<Textarea label="Anything you'd like to share (optional)" name="message" rows={3} bind:value={notes} />

		{#if message}
			<div class="form-error">{message}</div>
		{/if}

		<Button type="submit" disabled={!startTime}>Book discovery call</Button>
	</form>
</Dialog>

<style>
	.call-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.slot-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.slot-btn {
		padding: 8px 14px;
		border-radius: var(--radius-sm);
		border: 2px solid var(--border-subtle);
		box-shadow: var(--shadow-xs);
		background: var(--surface-card);
		color: var(--text-primary);
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.slot-btn:hover,
	.slot-btn.chosen {
		background: var(--coral-100);
		border-color: var(--coral-600);
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}

	.modality-note {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.modality-picker {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.modality-picker .field-label {
		font-weight: 600;
	}

	.modality-picker label {
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
	}
</style>
