<script lang="ts">
	import SlotRow from './SlotRow.svelte';
	import type { DesignedSlot } from '$lib/types/slots';

	let {
		slots = $bindable(),
		clients
	}: {
		slots: DesignedSlot[];
		// pass only for the weekly template, which is the only place a slot can be reserved
		clients?: { id: string; name: string }[];
	} = $props();

	// "HH:MM" + minutes, clamped to 23:59 so a new slot never spills into tomorrow
	function addMinutes(time: string, minutes: number): string {
		const [hour, minute] = time.split(':').map(Number);
		const total = Math.min(hour * 60 + minute + minutes, 23 * 60 + 59);
		const nextHour = String(Math.floor(total / 60)).padStart(2, '0');
		const nextMinute = String(total % 60).padStart(2, '0');
		return `${nextHour}:${nextMinute}`;
	}

	// a new slot starts where the latest one ends, an hour long, same type
	function addSlot() {
		let startTime = '09:00';
		let modality: DesignedSlot['modality'] = 'online';
		for (const slot of slots) {
			if (slot.endTime > startTime) {
				startTime = slot.endTime;
				modality = slot.modality;
			}
		}
		slots.push({ startTime, endTime: addMinutes(startTime, 60), modality });
	}

	function removeSlot(index: number) {
		slots.splice(index, 1);
	}
</script>

<div class="day-slots">
	{#each slots as _, index (index)}
		<SlotRow bind:slot={slots[index]} {clients} onremove={() => removeSlot(index)} />
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
