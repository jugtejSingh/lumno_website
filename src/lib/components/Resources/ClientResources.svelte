<script lang="ts">
	import { untrack } from 'svelte';
	import ResourceAddForm from './ResourceAddForm.svelte';
	import ResourceList from './ResourceList.svelte';
	import type { ResourceRow } from '$lib/types/resources';

	// Therapist-side resources for one client, shown in the /clients dialog. Owns its
	// fetch against GET /clients/[clientId]/resources, like PaymentHistoryList.
	let { clientId }: { clientId: string } = $props();

	let resources = $state<ResourceRow[]>([]);
	let loading = $state(false);
	let loadFailed = $state(false);

	async function load() {
		loading = true;
		loadFailed = false;
		try {
			const res = await fetch(`/clients/${clientId}/resources`);
			if (!res.ok) {
				loadFailed = true;
				return;
			}
			const body = await res.json();
			resources = body.resources;
		} catch {
			loadFailed = true;
		} finally {
			loading = false;
		}
	}

	// refetch whenever the dialog switches client; load itself is untracked so its
	// own state writes don't re-trigger this
	$effect(() => {
		const currentClientId = clientId;
		untrack(() => {
			if (currentClientId) {
				load();
			}
		});
	});
</script>

<div class="resources">
	<ResourceAddForm {clientId} onsaved={load} />

	<div class="divider"></div>

	{#if loadFailed}
		<p class="status">Couldn't load resources. <button type="button" onclick={load}>Retry</button></p>
	{:else if loading && resources.length === 0}
		<p class="status">Loading…</p>
	{:else}
		<ResourceList {resources} viewer="therapist" {clientId} ondeleted={load} />
	{/if}
</div>

<style>
	.resources {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.divider {
		border-top: 2px solid var(--border-subtle);
	}

	.status {
		margin: 0;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.status button {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-weight: 700;
		text-decoration: underline;
		color: var(--text-primary);
		cursor: pointer;
	}
</style>
