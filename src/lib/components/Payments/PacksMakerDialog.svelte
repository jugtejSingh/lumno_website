<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$lib/enhance';
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

	// form draft: deliberately seeded from the initial prop value only
	let clientName = $state(untrack(() => clients[0]?.name ?? ''));
	const clientId = $derived(clients.find((c) => c.name === clientName)?.id ?? '');

	$effect(() => {
		if (open) {
			clientName = clients[0]?.name ?? '';
		}
	});
</script>

<Dialog {open} title="Add a pack" {onclose}>
	<form
		class="packs-form"
		method="POST"
		action="?/createPack"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') onclose();
				await update();
			};
		}}
	>
		<Select label="Client" options={clients.map((c) => c.name)} bind:value={clientName} />
		<input type="hidden" name="clientId" value={clientId} />
		<Input label="Number of sessions" name="sessionCount" placeholder="5" />
		<Input label="Total price" name="amount" placeholder="4000" />
		<label class="paid-check">
			<input type="checkbox" name="paid" />
			<span>Already paid</span>
		</label>
		{#if message}
			<div class="form-error">{message}</div>
		{/if}
		<Button type="submit" variant="primary">Add pack</Button>
	</form>
</Dialog>

<style>
	.packs-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.paid-check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--text-primary);
	}

	.form-error {
		font-size: 13px;
		color: var(--danger, #b3261e);
	}
</style>
