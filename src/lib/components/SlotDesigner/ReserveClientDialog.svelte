<script lang="ts">
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { RESERVED_EVERY_WEEKS_CHOICES } from '$lib/bookingSchedule';

	// Picks who a weekly slot is held for and how often they come. A search box and a short
	// scrolling list stand in for a dropdown, which gets unwieldy with a long client list.
	let {
		clients,
		initialClientId,
		initialEveryWeeks,
		saving,
		error,
		onsave,
		onrelease,
		oncancel
	}: {
		clients: { id: string; name: string }[];
		initialClientId: string | null;
		initialEveryWeeks: number;
		saving: boolean;
		error: string;
		onsave: (clientId: string, everyWeeks: number) => void;
		// only passed when the slot already has a client
		onrelease?: () => void;
		oncancel: () => void;
	} = $props();

	// the dialog is created fresh each time it opens, so the starting values are read once
	// svelte-ignore state_referenced_locally
	let selectedClientId = $state<string | null>(initialClientId);
	// svelte-ignore state_referenced_locally
	let everyWeeks = $state(initialEveryWeeks);
	let search = $state('');

	const visibleClients = $derived.by(() => {
		const needle = search.trim().toLowerCase();
		const matches: { id: string; name: string }[] = [];
		for (const client of clients) {
			if (needle === '' || client.name.toLowerCase().includes(needle)) {
				matches.push(client);
			}
		}
		return matches;
	});

	function save() {
		if (selectedClientId !== null) {
			onsave(selectedClientId, everyWeeks);
		}
	}
</script>

<Dialog open={true} title="Reserve this slot" width="clamp(300px, 90vw, 420px)" onclose={oncancel}>
	<div class="body">
		<label class="field">
			<span class="label">Client</span>
			<input
				type="search"
				class="search"
				placeholder="Search clients"
				bind:value={search}
				autocomplete="off"
			/>
		</label>

		<div class="client-list" role="radiogroup" aria-label="Client">
			{#each visibleClients as client (client.id)}
				<label class="client-option" class:selected={selectedClientId === client.id}>
					<input type="radio" name="reserve-client" value={client.id} bind:group={selectedClientId} />
					<span>{client.name}</span>
				</label>
			{:else}
				<div class="empty">No clients match</div>
			{/each}
		</div>

		<fieldset class="frequency">
			<legend class="label">How often</legend>
			<div class="frequency-options">
				{#each RESERVED_EVERY_WEEKS_CHOICES as choice (choice.weeks)}
					<label class="frequency-option" class:selected={everyWeeks === choice.weeks}>
						<input type="radio" name="reserve-frequency" value={choice.weeks} bind:group={everyWeeks} />
						<span>{choice.label}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		{#if error}
			<div class="error">{error}</div>
		{/if}

		<div class="actions">
			{#if onrelease}
				<button type="button" class="release" disabled={saving} onclick={onrelease}>Release slot</button>
			{/if}
			<Button type="button" variant="secondary" onclick={oncancel}>Cancel</Button>
			<Button type="button" variant="primary" disabled={saving || selectedClientId === null} onclick={save}>
				Save
			</Button>
		</div>
	</div>
</Dialog>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		padding: 0;
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.search {
		padding: 8px 10px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		font-size: 14px;
		color: var(--text-primary);
	}

	.search:focus-visible {
		outline: none;
		box-shadow: var(--shadow-focus);
	}

	.client-list {
		display: flex;
		flex-direction: column;
		max-height: 190px;
		overflow-y: auto;
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
	}

	.client-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		font-size: 14px;
		color: var(--text-primary);
		cursor: pointer;
	}

	.client-option:hover {
		background: var(--coral-100);
	}

	.client-option.selected {
		background: var(--coral-100);
		font-weight: 700;
	}

	.empty {
		padding: 10px;
		font-size: 13px;
		font-style: italic;
		color: var(--text-muted);
	}

	.frequency {
		margin: 0;
		padding: 0;
		border: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.frequency-options {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.frequency-option {
		padding: 5px 12px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-pill);
		background: var(--surface-card);
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 700;
		color: var(--text-muted);
		cursor: pointer;
	}

	.frequency-option.selected {
		background: var(--citrus-400);
		color: var(--text-primary);
	}

	/* the radio dot is replaced by the chip's own highlight */
	.frequency-option input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.frequency-option:focus-within {
		box-shadow: var(--shadow-focus);
	}

	.error {
		font-size: 13px;
		color: var(--danger);
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}

	.release {
		margin-right: auto;
		padding: 0;
		border: none;
		background: transparent;
		font-size: 13px;
		color: var(--danger);
		text-decoration: underline;
		cursor: pointer;
	}

	.release:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
