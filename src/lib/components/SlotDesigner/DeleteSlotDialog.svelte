<script lang="ts">
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';

	// Shown before deleting an open weekly slot. A reserved one uses ReservedSlotChangeDialog.
	let {
		onconfirm,
		oncancel
	}: {
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

<Dialog open={true} title="Delete this slot?" onclose={oncancel}>
	<div class="body">
		<p>
			Sessions already booked <strong>will stay</strong>. Clients won’t be able to book this time
			again.
		</p>
		<div class="actions">
			<Button type="button" variant="secondary" onclick={oncancel}>Cancel</Button>
			<Button type="button" variant="primary" onclick={onconfirm}>Delete slot</Button>
		</div>
	</div>
</Dialog>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-size: 14px;
		color: var(--text-secondary);
	}

	p {
		margin: 0;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
