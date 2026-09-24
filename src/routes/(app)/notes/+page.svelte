<script lang="ts">
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import ClientList from '$lib/components/Notes/ClientList.svelte';
	import ClientNotesPanel from '$lib/components/Notes/ClientNotesPanel.svelte';
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// svelte-ignore state_referenced_locally
	const wantedClient = data.clients.find((c) => c.name === page.url.searchParams.get('client'));
	// svelte-ignore state_referenced_locally
	let selectedId = $state(wantedClient?.id ?? data.clients[0]?.id);
	let query = $state('');

	const selected = $derived(data.clients.find((c) => c.id === selectedId) ?? data.clients[0]);
	const sessions = $derived(data.sessionsByClient[selectedId] ?? []);

	function select(id: string) {
		selectedId = id;
	}
</script>

<div class="notes-shell">
	<ClientList clients={data.clients} {selectedId} bind:query onselect={select} />

	<div class="detail">
		{#if !selected}
			<div class="detail-inner">
				<div class="empty">No clients yet.</div>
			</div>
		{:else}
			<div class="detail-inner">
				<div class="client-head">
					<Avatar name={selected.name} size={40} />
					<div>
						<div class="client-name">{selected.name}</div>
						<div class="client-meta">
							{selected.notes.length} private · {selected.sharedNotes.length} shared with client
						</div>
					</div>
				</div>

				<ClientNotesPanel client={selected} {sessions} {form} />
			</div>
		{/if}
	</div>
</div>

<style>
	.notes-shell {
		display: flex;
		height: 100%;
		min-height: 0;
		margin: calc(-1 * clamp(16px, 4vw, 24px));
	}

	.detail {
		flex: 1;
		padding: clamp(16px, 4vw, 24px);
		overflow-y: auto;
	}

	.detail-inner {
		max-width: 680px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* ponytail: below 720px the client rail stacks above the note detail */
	@media (max-width: 720px) {
		.notes-shell {
			flex-direction: column;
			height: auto;
		}
	}

	.client-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.client-name {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(22px, 5vw, 26px);
		color: var(--text-primary);
	}

	.client-meta {
		font-size: 13px;
		color: var(--text-muted);
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
