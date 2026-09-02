<script lang="ts">
	import { enhance } from '$app/forms';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Select from '$lib/components/utils/Select.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import type { ClientOption } from '$lib/types/payments';

	let {
		open,
		clients,
		message,
		onclose
	}: {
		open: boolean;
		clients: ClientOption[];
		message?: string;
		onclose: () => void;
	} = $props();

	let useCustomName = $state(false);
	let customName = $state('');
	let clientName = $state(clients[0]?.name ?? '');
	const clientId = $derived(clients.find((c) => c.name === clientName)?.id ?? '');

	// same reset the old page-level openAddCharge() did, now keyed off the dialog opening
	$effect(() => {
		if (open) {
			useCustomName = false;
			customName = '';
		}
	});
</script>

<Dialog {open} title="Add a charge" {onclose}>
	<form
		class="add-charge-form"
		method="POST"
		action="?/addCharge"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') onclose();
				await update();
			};
		}}
	>
		<div class="client-toggle">
			<button
				type="button"
				class="toggle-btn"
				class:active={!useCustomName}
				onclick={() => (useCustomName = false)}
			>
				Existing client
			</button>
			<button
				type="button"
				class="toggle-btn"
				class:active={useCustomName}
				onclick={() => (useCustomName = true)}
			>
				Custom name
			</button>
		</div>
		{#if useCustomName}
			<Input label="Name" name="customName" bind:value={customName} />
		{:else}
			<Select label="Client" options={clients.map((c) => c.name)} bind:value={clientName} />
			<input type="hidden" name="clientId" value={clientId} />
		{/if}
		<Input label="Amount" name="amount" placeholder="150" />
		<Input label="Note" name="note" placeholder="e.g. late cancellation fee" />
		{#if message}
			<div class="form-error">{message}</div>
		{/if}
		<Button type="submit" variant="primary">Add charge</Button>
	</form>
</Dialog>

<style>
	.add-charge-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 300px;
	}

	.client-toggle {
		display: flex;
		gap: 6px;
	}

	.toggle-btn {
		flex: 1;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-card);
		color: var(--text-secondary);
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.toggle-btn.active {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: var(--text-on-accent);
	}

	.form-error {
		font-size: 13px;
		color: var(--danger, #b3261e);
	}
</style>
