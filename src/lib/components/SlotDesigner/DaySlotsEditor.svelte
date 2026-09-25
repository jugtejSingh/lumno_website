<script lang="ts">
	import SlotRow from './SlotRow.svelte';
	import { nextSlot } from './nextSlot';
	import type { DesignedSlot } from '$lib/types/slots';

	// a date override's slots, edited as a draft and saved together (DateSlotsPanel). The weekly
	// template saves slot by slot instead (WeeklyDayEditor).
	let { slots = $bindable() }: { slots: DesignedSlot[] } = $props();

	function addSlot() {
		slots.push(nextSlot(slots));
	}
</script>

<div class="day-slots">
	{#each slots as _, index (index)}
		<SlotRow bind:slot={slots[index]} onremove={() => slots.splice(index, 1)} />
	{/each}
	{#if slots.length === 0}
		<div class="empty">No slots — clients can’t book this day.</div>
	{/if}
	<button type="button" class="add-btn" onclick={addSlot}>+ Add slot</button>
</div>

<style>
	.day-slots {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.empty {
		font-size: 13px;
		font-style: italic;
		color: var(--text-muted);
	}

	.add-btn {
		align-self: flex-start;
		padding: 5px 12px;
		border-radius: var(--radius-pill);
		border: 2px dashed var(--outline);
		background: var(--surface-card);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		text-transform: uppercase;
		cursor: pointer;
	}

	.add-btn:hover {
		background: var(--coral-100);
	}
</style>
