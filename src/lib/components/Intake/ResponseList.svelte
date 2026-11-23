<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';

	type ResponseSummary = {
		id: string;
		name: string | null;
		email: string | null;
		clientId: string | null;
		createdAt: Date;
	};

	let { responses }: { responses: ResponseSummary[] } = $props();

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function displayName(response: ResponseSummary): string {
		if (response.name) {
			return response.name;
		}
		if (response.email) {
			return response.email;
		}
		return 'Anonymous';
	}
</script>

<div class="list">
	<div class="list-title">Responses</div>
	{#each responses as response (response.id)}
		<Card href="/intake/{response.id}" interactive>
			<div class="row">
				<div class="who">
					<div class="name">{displayName(response)}</div>
					{#if response.name && response.email}
						<div class="email">{response.email}</div>
					{/if}
				</div>
				<div class="meta">
					{#if response.clientId}
						<Badge tone="success">Imported</Badge>
					{/if}
					<span class="date">{formatDate(response.createdAt)}</span>
				</div>
			</div>
		</Card>
	{:else}
		<div class="empty">No one has filled in your form yet.</div>
	{/each}
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.list-title {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.who {
		min-width: 0;
	}

	.name {
		font-weight: 600;
		color: var(--text-primary);
	}

	.email {
		font-size: 13px;
		color: var(--text-secondary);
		overflow-wrap: anywhere;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.date {
		font-size: 13px;
		color: var(--text-muted);
	}

	.empty {
		font-size: 14px;
		color: var(--text-secondary);
	}
</style>
