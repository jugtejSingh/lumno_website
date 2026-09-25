<script lang="ts">
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';

	// Shown before a client reschedules a pack session that is too close to its start: the pack
	// credit is lost and, with none left, the new session is charged at the regular rate.
	let {
		onconfirm,
		oncancel
	}: {
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

<Dialog open={true} title="Rescheduling will be charged" onclose={oncancel}>
	<div class="body">
		<p>
			This session is within the late-change window, so its pack credit is used up. You have no
			pack sessions left, so the new session will be charged at the regular session rate.
		</p>
		<div class="actions">
			<Button type="button" variant="secondary" onclick={oncancel}>Keep my session</Button>
			<Button type="button" variant="primary" onclick={onconfirm}>Reschedule anyway</Button>
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
