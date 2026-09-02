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

	let clientName = $state(clients[0]?.name ?? '');
	const clientId = $derived(clients.find((c) => c.name === clientName)?.id ?? '');
</script>

<Dialog {open} title="Add a session pack" {onclose}>
	<form
		class="add-pack-form"
		method="POST"
		action="?/addPack"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') onclose();
				await update();
			};
		}}
	>
		<Select label="Client" options={clients.map((c) => c.name)} bind:value={clientName} />
		<input type="hidden" name="clientId" value={clientId} />
		<Input label="Session count" name="sessionCount" placeholder="12" />
		<Input label="Total amount" name="amount" placeholder="1800" />
		{#if message}
			<div class="form-error">{message}</div>
		{/if}
		<Button type="submit" variant="primary">Add pack</Button>
	</form>
</Dialog>

<style>
	.add-pack-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 300px;
	}

	.form-error {
		font-size: 13px;
		color: var(--danger, #b3261e);
	}
</style>
