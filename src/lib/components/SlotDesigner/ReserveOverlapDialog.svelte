<script lang="ts">
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';

	// Shown before reserving a slot for a client who already holds another reserved slot. The
	// reservation books the next two weeks straight away, so the client would be booked at both
	// times, and sessions already booked at the old time are never cancelled automatically.
	let {
		clientName,
		heldSlots,
		onconfirm,
		oncancel
	}: {
		clientName: string;
		// the client's existing reserved slots, e.g. "Tuesday 10:00–11:00"
		heldSlots: string[];
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

<Dialog open={true} title="{clientName} already has a reserved slot" onclose={oncancel}>
	<div class="body">
		<p>{clientName} already holds:</p>
		<ul>
			{#each heldSlots as held (held)}
				<li>{held}</li>
			{/each}
		</ul>
		<p>
			Reserving this slot too books them at <strong>both times</strong> every week. If you’re
			moving them, delete their already-booked sessions at the old time yourself.
		</p>
		<div class="actions">
			<Button type="button" variant="secondary" onclick={oncancel}>Cancel</Button>
			<Button type="button" variant="primary" onclick={onconfirm}>Reserve anyway</Button>
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

	ul {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
