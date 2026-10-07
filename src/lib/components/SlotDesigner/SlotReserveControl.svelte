<script lang="ts">
	import type { DesignedSlot } from '$lib/types/slots';
	import ReserveClientDialog from './ReserveClientDialog.svelte';
	import ReserveOverlapDialog from './ReserveOverlapDialog.svelte';
	import ReservedSlotChangeDialog from './ReservedSlotChangeDialog.svelte';
	import { useHeldSlotsLookup } from './reservedSlotsContext';
	import { bookingSummary, postSlotAction } from './slotActions';
	import { reservedFrequencyLabel } from '$lib/bookingSchedule';

	// Holds a weekly slot for one client at a chosen frequency, or releases it. The chip at the end
	// of the row opens a small dialog; saving posts ?/reserveSlot. Changing who holds a reserved
	// slot (or how often) deletes their future sessions, so that asks first.
	let {
		slot,
		clients
	}: {
		slot: DesignedSlot;
		clients: { id: string; name: string }[];
	} = $props();

	const lookupHeldSlots = useHeldSlotsLookup();

	const savedEveryWeeks = $derived(slot.reservedEveryWeeks ?? 1);

	let dialogOpen = $state(false);
	let saving = $state(false);
	let error = $state('');
	let summary = $state('');
	// the pick waiting on a confirm modal; null = nothing waiting. '' means release.
	let pendingClientId = $state<string | null>(null);
	let pendingEveryWeeks = $state(1);
	let confirmingChange = $state(false);
	let pendingHeldSlots = $state<string[]>([]);

	function nameOf(clientId: string | null | undefined): string {
		for (const client of clients) {
			if (client.id === clientId) {
				return client.name;
			}
		}
		return 'This client';
	}

	function openDialog() {
		error = '';
		summary = '';
		dialogOpen = true;
	}

	function closeDialog() {
		dialogOpen = false;
		cancelPick();
	}

	function onSave(clientId: string, everyWeeks: number) {
		if (clientId === slot.reservedClientId && everyWeeks === savedEveryWeeks) {
			closeDialog();
			return;
		}
		pendingClientId = clientId;
		pendingEveryWeeks = everyWeeks;
		if (slot.reservedClientId) {
			confirmingChange = true;
			return;
		}
		checkHeldSlots();
	}

	function onRelease() {
		pendingClientId = '';
		pendingEveryWeeks = 1;
		confirmingChange = true;
	}

	// A client who already holds another slot would be booked at both times, so ask first.
	// Only a different client can cause that; changing just the frequency can't.
	function checkHeldSlots() {
		confirmingChange = false;
		const clientId = pendingClientId;
		if (clientId === null) {
			return;
		}
		if (clientId !== '' && clientId !== slot.reservedClientId && slot.id && lookupHeldSlots) {
			const held = lookupHeldSlots(clientId, slot.id);
			if (held.length > 0) {
				pendingHeldSlots = held;
				return;
			}
		}
		reserve(clientId, pendingEveryWeeks);
		pendingClientId = null;
	}

	function confirmOverlap() {
		const clientId = pendingClientId;
		pendingClientId = null;
		pendingHeldSlots = [];
		if (clientId !== null) {
			reserve(clientId, pendingEveryWeeks);
		}
	}

	// back to the reserve dialog with nothing waiting; it stays open for another go
	function cancelPick() {
		pendingClientId = null;
		confirmingChange = false;
		pendingHeldSlots = [];
	}

	async function reserve(clientId: string, everyWeeks: number) {
		if (!slot.id) {
			return;
		}
		saving = true;
		error = '';
		summary = '';
		const result = await postSlotAction('reserveSlot', {
			slotId: slot.id,
			clientId,
			everyWeeks: String(everyWeeks)
		});
		saving = false;
		if (!result.ok) {
			error = result.message;
			return;
		}
		dialogOpen = false;
		if (result.booking) {
			summary = bookingSummary(result.booking);
		}
	}
</script>

{#if slot.modality !== 'hybrid' && slot.id}
	<div class="reserve">
		{#if slot.reservedClientId}
			<button type="button" class="reserve-chip reserved" onclick={openDialog}>
				<span class="chip-name">{nameOf(slot.reservedClientId)}</span>
				<span class="chip-frequency">{reservedFrequencyLabel(savedEveryWeeks)}</span>
			</button>
		{:else}
			<button type="button" class="reserve-chip" onclick={openDialog}>+ Add client</button>
		{/if}
		{#if summary}
			<span class="summary">{summary}</span>
		{/if}
	</div>
{/if}

{#if dialogOpen}
	<ReserveClientDialog
		{clients}
		initialClientId={slot.reservedClientId ?? null}
		initialEveryWeeks={savedEveryWeeks}
		{saving}
		{error}
		onsave={onSave}
		onrelease={slot.reservedClientId ? onRelease : undefined}
		oncancel={closeDialog}
	/>
{/if}

{#if confirmingChange}
	<ReservedSlotChangeDialog
		clientName={nameOf(slot.reservedClientId)}
		onconfirm={checkHeldSlots}
		oncancel={cancelPick}
	/>
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
		justify-content: flex-end;
		gap: 6px;
	}

	.reserve-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
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

	.reserve-chip:hover {
		background: var(--coral-100);
	}

	.reserve-chip.reserved {
		border-style: solid;
		background: var(--coral-100);
		color: var(--text-primary);
	}

	.reserve-chip:focus-visible {
		outline: none;
		box-shadow: var(--shadow-focus);
	}

	.chip-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 140px;
	}

	.chip-frequency {
		font-weight: 400;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.summary {
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
