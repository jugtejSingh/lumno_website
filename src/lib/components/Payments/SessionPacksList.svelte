<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/utils/Card.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import type { PackRow } from '$lib/types/payments';

	let {
		packs,
		message,
		onAddPack
	}: {
		packs: PackRow[];
		message?: string;
		onAddPack: () => void;
	} = $props();

	const badgeTone = {
		pending_payment: 'warning',
		active: 'success',
		completed: 'citrus',
		cancelled: 'danger'
	} as const;
</script>

<div class="section-header">
	<div class="section-title">Session packs</div>
	<Button variant="pop" size="sm" onclick={onAddPack}>+ Add pack</Button>
</div>
<div class="pack-list">
	{#each packs as p (p.id)}
		<Card>
			<div class="pack-row">
				<div class="pack-head">
					<span class="pack-client">{p.clientName}</span>
					<Badge tone={badgeTone[p.status]}>{p.status.replace('_', ' ')}</Badge>
					<span class="pack-remaining">{p.remaining} of {p.sessionCount} remaining</span>
				</div>
				<div class="pack-actions">
					<form
						method="POST"
						action="?/updatePack"
						use:enhance={() => {
							return async ({ update }) => update();
						}}
					>
						<input type="hidden" name="packId" value={p.id} />
						<div class="pack-edit-fields">
							<Input name="sessionCount" value={String(p.sessionCount)} />
							<Input name="amount" value={String(p.amount)} />
							<Button type="submit" variant="secondary" size="sm">Save</Button>
						</div>
					</form>
					{#if p.status === 'pending_payment'}
						<form
							method="POST"
							action="?/markPackPaid"
							use:enhance={() => {
								return async ({ update }) => update();
							}}
						>
							<input type="hidden" name="packId" value={p.id} />
							<Button type="submit" variant="primary" size="sm">Mark paid</Button>
						</form>
					{/if}
					{#if p.status !== 'cancelled'}
						<form
							method="POST"
							action="?/cancelPack"
							use:enhance={() => {
								return async ({ update }) => update();
							}}
						>
							<input type="hidden" name="packId" value={p.id} />
							<Button type="submit" variant="secondary" size="sm">Cancel</Button>
						</form>
					{/if}
				</div>
			</div>
		</Card>
	{/each}
	{#if packs.length === 0}
		<div class="empty">No session packs yet.</div>
	{/if}
	{#if message}
		<div class="form-error">{message}</div>
	{/if}
</div>

<style>
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.pack-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.pack-row {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.pack-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.pack-client {
		font-weight: 700;
		color: var(--text-primary);
	}

	.pack-remaining {
		margin-left: auto;
		font-size: 13px;
		color: var(--text-muted);
	}

	.pack-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.pack-edit-fields {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}

	.pack-edit-fields :global(.field) {
		width: 100px;
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}

	.form-error {
		font-size: 13px;
		color: var(--danger, #b3261e);
	}
</style>
