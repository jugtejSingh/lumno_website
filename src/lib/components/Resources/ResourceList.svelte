<script lang="ts">
	import { toast } from 'svelte-sonner';
	import Tag from '$lib/components/utils/Tag.svelte';
	import { postResourceAction } from '$lib/resourceActionClient';
	import { RESOURCE_TAG_LABELS, type ResourceRow, type ResourceUploader } from '$lib/types/resources';

	// viewer: who is looking. Delete only shows on rows they uploaded — the server
	// enforces the same rule.
	let {
		resources,
		viewer,
		clientId,
		ondeleted
	}: {
		resources: ResourceRow[];
		viewer: ResourceUploader;
		clientId?: string;
		ondeleted: () => void;
	} = $props();

	let deletingId = $state<string | null>(null);

	function formatDate(value: Date | string): string {
		// Date from a page load, ISO string from the JSON endpoint
		return new Date(value).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function uploaderLabel(uploadedBy: ResourceUploader): string {
		if (uploadedBy === viewer) {
			return 'Added by you';
		}
		if (uploadedBy === 'therapist') {
			return 'Added by your therapist';
		}
		return 'Added by client';
	}

	async function remove(resource: ResourceRow) {
		if (!confirm(`Delete "${resource.name}"? This cannot be undone.`)) {
			return;
		}
		const fields: Record<string, string> = { resourceId: resource.id };
		if (clientId) {
			fields.clientId = clientId;
		}
		deletingId = resource.id;
		const result = await postResourceAction('deleteResource', fields);
		deletingId = null;
		if (!result.ok) {
			toast.error(result.message);
			return;
		}
		toast.success('Resource deleted');
		ondeleted();
	}
</script>

{#if resources.length === 0}
	<p class="empty">No resources yet.</p>
{:else}
	<ul class="list">
		{#each resources as resource (resource.id)}
			<li class="item">
				<div class="main">
					<a class="name" href={resource.href} target="_blank" rel="noopener noreferrer">
						{resource.name}
					</a>
					<span class="meta">
						{#if resource.kind === 'link'}Link · {/if}{uploaderLabel(resource.uploadedBy)} · {formatDate(
							resource.createdAt
						)}
					</span>
				</div>
				<Tag color="beige">{RESOURCE_TAG_LABELS[resource.tag]}</Tag>
				{#if resource.uploadedBy === viewer}
					<button
						type="button"
						class="delete"
						disabled={deletingId === resource.id}
						onclick={() => remove(resource)}
					>
						Delete
					</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.empty {
		margin: 0;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
	}

	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.name {
		font-weight: 700;
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	.meta {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.delete {
		background: none;
		border: none;
		padding: 4px;
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.delete:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	@media (max-width: 600px) {
		.item {
			flex-wrap: wrap;
		}
	}
</style>
