<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { DesignedSlot } from '$lib/types/slots';

	// Holds a saved weekly slot for one client every week. Deliberately not part of the weekly
	// save: it posts to its own action (?/reserveSlot) as soon as a client is picked, so a
	// reservation can never be wiped or changed by saving the template.
	let {
		slot = $bindable(),
		clients
	}: {
		slot: DesignedSlot;
		clients: { id: string; name: string }[];
	} = $props();

	let saving = $state(false);
	let error = $state('');

	async function reserve(clientId: string) {
		if (!slot.id) {
			return;
		}
		saving = true;
		error = '';
		try {
			const body = new FormData();
			body.set('slotId', slot.id);
			body.set('clientId', clientId);
			const response = await fetch('?/reserveSlot', {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body
			});
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				if (clientId === '') {
					slot.reservedClientId = null;
				} else {
					slot.reservedClientId = clientId;
				}
				await invalidateAll();
			} else if (result.type === 'failure') {
				error = 'Could not reserve that slot';
				const message = result.data?.message;
				if (typeof message === 'string') {
					error = message;
				}
			} else {
				error = 'Could not reserve that slot';
			}
		} catch {
			error = 'Could not reserve that slot';
		} finally {
			saving = false;
		}
	}
</script>

{#if slot.modality !== 'hybrid'}
	<div class="reserve">
		{#if slot.id}
			<label class="reserve-chip" class:reserved={!!slot.reservedClientId}>
				<span class="sr-only">Reserved for</span>
				<select
					value={slot.reservedClientId ?? ''}
					disabled={saving}
					onchange={(event) => reserve(event.currentTarget.value)}
				>
					<option value="">Open to everyone</option>
					{#each clients as client (client.id)}
						<option value={client.id}>Reserved: {client.name}</option>
					{/each}
				</select>
			</label>
		{:else}
			<span class="hint">Save to reserve</span>
		{/if}
		{#if error}
			<span class="error">{error}</span>
		{/if}
	</div>
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

	.hint {
		font-size: 11.5px;
		font-style: italic;
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
