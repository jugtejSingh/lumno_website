<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import type { NotesClient } from '$lib/types/notes';

	let {
		clients,
		selectedId,
		query = $bindable(''),
		onselect
	}: {
		clients: NotesClient[];
		selectedId: string;
		query?: string;
		onselect: (id: string) => void;
	} = $props();

	const filtered = $derived(
		clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
	);

	function summary(c: NotesClient): string {
		const total = c.notes.length + c.sharedNotes.length;
		return total ? `${total} note${total > 1 ? 's' : ''} on file` : 'No notes yet';
	}
</script>

<div class="list-panel">
	<Input placeholder="Search clients" bind:value={query} />
	<div class="rows">
		{#each filtered as c (c.id)}
			<button type="button" class="row" class:active={c.id === selectedId} onclick={() => onselect(c.id)}>
				<Avatar name={c.name} size={32} />
				<div class="row-info">
					<div class="row-name">{c.name}</div>
					<div class="row-summary">{summary(c)}</div>
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.list-panel {
		width: 280px;
		flex-shrink: 0;
		border-right: 1px solid var(--border-subtle);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow-y: auto;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		background: transparent;
		border: none;
		text-align: left;
		font-family: var(--font-body);
	}

	.row.active {
		background: var(--surface-sunken);
	}

	.row-info {
		flex: 1;
		min-width: 0;
	}

	.row-name {
		font-weight: 700;
		font-size: 14px;
		color: var(--text-primary);
	}

	.row-summary {
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
