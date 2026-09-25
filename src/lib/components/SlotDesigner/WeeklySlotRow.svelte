<script lang="ts">
	import SlotRow from './SlotRow.svelte';
	import SlotReserveControl from './SlotReserveControl.svelte';
	import DeleteSlotDialog from './DeleteSlotDialog.svelte';
	import ReservedSlotChangeDialog from './ReservedSlotChangeDialog.svelte';
	import { bookingSummary, postSlotAction } from './slotActions';
	import type { DesignedSlot } from '$lib/types/slots';

	// One stored weekly slot. Edits stay local until Save posts ?/updateSlot; the trash posts
	// ?/deleteSlot. A reserved slot asks first, since both delete its client's future sessions.
	let {
		slot,
		weekday,
		clients
	}: {
		slot: DesignedSlot;
		weekday: number;
		clients: { id: string; name: string }[];
	} = $props();

	let edit = $state<DesignedSlot>({ startTime: '', endTime: '', modality: 'online' });
	// reset to the stored slot whenever the page data reloads
	$effect(() => {
		edit = { startTime: slot.startTime, endTime: slot.endTime, modality: slot.modality };
	});

	const changed = $derived(
		edit.startTime !== slot.startTime || edit.endTime !== slot.endTime || edit.modality !== slot.modality
	);

	const clientName = $derived.by(() => {
		for (const client of clients) {
			if (client.id === slot.reservedClientId) {
				return client.name;
			}
		}
		return 'This client';
	});

	let saving = $state(false);
	let error = $state('');
	let summary = $state('');
	// the change waiting on its confirm modal; null = no modal
	let pending = $state<'save' | 'delete' | null>(null);

	function ask(kind: 'save' | 'delete') {
		if (kind === 'save' && !slot.reservedClientId) {
			save();
			return;
		}
		pending = kind;
	}

	function confirm() {
		const kind = pending;
		pending = null;
		if (kind === 'save') {
			save();
		} else if (kind === 'delete') {
			remove();
		}
	}

	async function save() {
		saving = true;
		error = '';
		summary = '';
		const result = await postSlotAction('updateSlot', {
			slotId: slot.id!,
			weekday: String(weekday),
			startTime: edit.startTime,
			endTime: edit.endTime,
			modality: edit.modality
		});
		saving = false;
		if (!result.ok) {
			error = result.message;
		} else if (result.booking) {
			summary = bookingSummary(result.booking);
		}
	}

	async function remove() {
		saving = true;
		error = '';
		const result = await postSlotAction('deleteSlot', { slotId: slot.id! });
		saving = false;
		if (!result.ok) {
			error = result.message;
		}
	}
</script>

<div class="weekly-slot">
	<SlotRow bind:slot={edit} onremove={() => ask('delete')}>
		{#if changed}
			<button type="button" class="save-btn" disabled={saving} onclick={() => ask('save')}>Save</button>
		{:else}
			<SlotReserveControl {slot} {clients} />
		{/if}
	</SlotRow>
	{#if summary}
		<span class="summary">{summary}</span>
	{/if}
	{#if error}
		<span class="error">{error}</span>
	{/if}
</div>

{#if pending !== null && slot.reservedClientId}
	<ReservedSlotChangeDialog {clientName} onconfirm={confirm} oncancel={() => (pending = null)} />
{:else if pending === 'delete'}
	<DeleteSlotDialog onconfirm={confirm} oncancel={() => (pending = null)} />
{/if}

<style>
	.weekly-slot {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.save-btn {
		padding: 5px 12px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--citrus-400);
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-primary);
		cursor: pointer;
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.summary {
		font-size: 12px;
		color: var(--text-muted);
	}

	.error {
		font-size: 12px;
		color: var(--danger);
	}
</style>
