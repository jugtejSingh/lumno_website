<script lang="ts">
	import type { DesignedSlot } from '$lib/types/slots';
	import ReserveOverlapDialog from './ReserveOverlapDialog.svelte';
	import ReservedSlotChangeDialog from './ReservedSlotChangeDialog.svelte';
	import { useHeldSlotsLookup } from './reservedSlotsContext';
	import { bookingSummary, postSlotAction } from './slotActions';

	// Holds a weekly slot for one client every week, or releases it. Posts ?/reserveSlot as soon
	// as a client is picked. Changing who holds a reserved slot deletes their future sessions,
	// so that asks first.
	let {
		slot,
		clients
	}: {
		slot: DesignedSlot;
		clients: { id: string; name: string }[];
	} = $props();

	const lookupHeldSlots = useHeldSlotsLookup();

	let saving = $state(false);
	let error = $state('');
	let summary = $state('');
	// the pick waiting on a modal; null = no modal
	let pendingClientId = $state<string | null>(null);
	let confirmingRelease = $state(false);
	let pendingHeldSlots = $state<string[]>([]);
	let selectElement = $state<HTMLSelectElement>();

	function nameOf(clientId: string | null | undefined): string {
		for (const client of clients) {
			if (client.id === clientId) {
				return client.name;
			}
		}
		return 'This client';
	}

	function onPick(clientId: string) {
		pendingClientId = clientId;
		if (slot.reservedClientId) {
			confirmingRelease = true;
			return;
		}
		checkHeldSlots();
	}

	// A client who already holds another slot would be booked at both times, so ask first.
	function checkHeldSlots() {
		confirmingRelease = false;
		const clientId = pendingClientId;
		if (clientId === null) {
			return;
		}
		if (clientId !== '' && slot.id && lookupHeldSlots) {
			const held = lookupHeldSlots(clientId, slot.id);
			if (held.length > 0) {
				pendingHeldSlots = held;
				return;
			}
		}
		pendingClientId = null;
		reserve(clientId);
	}

	function confirmOverlap() {
		const clientId = pendingClientId;
		pendingClientId = null;
		pendingHeldSlots = [];
		if (clientId !== null) {
			reserve(clientId);
		}
	}

	// the select already shows the new pick, so put it back to what is actually saved
	function cancelPick() {
		pendingClientId = null;
		confirmingRelease = false;
		pendingHeldSlots = [];
		if (selectElement) {
			selectElement.value = slot.reservedClientId ?? '';
		}
	}

	async function reserve(clientId: string) {
		if (!slot.id) {
			return;
		}
		saving = true;
		error = '';
		summary = '';
		const result = await postSlotAction('reserveSlot', { slotId: slot.id, clientId });
		saving = false;
		if (!result.ok) {
			error = result.message;
			cancelPick();
			return;
		}
		if (result.booking) {
			summary = bookingSummary(result.booking);
		}
	}
</script>

{#if slot.modality !== 'hybrid' && slot.id}
	<div class="reserve">
		<label class="reserve-chip" class:reserved={!!slot.reservedClientId}>
			<span class="sr-only">Reserved for</span>
			<select
				bind:this={selectElement}
				value={slot.reservedClientId ?? ''}
				disabled={saving}
				onchange={(event) => onPick(event.currentTarget.value)}
			>
				<option value="">Open to everyone</option>
				{#each clients as client (client.id)}
					<option value={client.id}>Reserved: {client.name}</option>
				{/each}
			</select>
		</label>
		{#if summary}
			<span class="summary">{summary}</span>
		{/if}
		{#if error}
			<span class="error">{error}</span>
		{/if}
	</div>
{/if}

{#if confirmingRelease}
	<ReservedSlotChangeDialog clientName={nameOf(slot.reservedClientId)} onconfirm={checkHeldSlots} oncancel={cancelPick} />
{:else if pendingHeldSlots.length > 0}
	<ReserveOverlapDialog
		clientName={nameOf(pendingClientId)}
		heldSlots={pendingHeldSlots}
		onconfirm={confirmOverlap}
		oncancel={cancelPick}
	/>
{/if}

<style>
	.reserve {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.reserve-chip select {
		appearance: none;
		max-width: 180px;
		padding: 5px 12px;
		border: 2px dashed var(--outline);
		border-radius: var(--radius-pill);
		background: var(--surface-card);
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		color: var(--text-muted);
		cursor: pointer;
	}

	.reserve-chip.reserved select {
		border-style: solid;
		background: var(--coral-100);
		color: var(--text-primary);
	}

	.reserve-chip select:focus-visible {
		outline: none;
		box-shadow: var(--shadow-focus);
	}

	.summary {
		font-size: 12px;
		color: var(--text-muted);
	}

	.error {
		font-size: 12px;
		color: var(--danger);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
