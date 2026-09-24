<script lang="ts">
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import type { ReservedSlotChange } from '$lib/types/slots';

	// Shown before a weekly save that edits or removes a slot held for a client. Sessions
	// already booked from that slot are never cancelled automatically, so the therapist has to.
	let {
		changes,
		onconfirm,
		oncancel
	}: {
		changes: ReservedSlotChange[];
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

<Dialog open={true} title="Delete their booked sessions yourself" onclose={oncancel}>
	<div class="body">
		<p>
			You’re changing or removing a slot held for a client. Sessions already booked from it
			<strong>stay on your calendar</strong> — please delete them manually.
		</p>
		<ul>
			{#each changes as change (change.clientName + change.weekdayName + change.time)}
				<li>
					<strong>{change.clientName}</strong> — {change.weekdayName} {change.time}
					({change.kind === 'removed' ? 'removed' : 'changed'})
				</li>
			{/each}
		</ul>
		<div class="actions">
			<Button type="button" variant="secondary" onclick={oncancel}>Go back</Button>
			<Button type="button" variant="primary" onclick={onconfirm}>Save anyway</Button>
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
