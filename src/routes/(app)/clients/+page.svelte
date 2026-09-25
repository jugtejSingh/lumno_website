<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import Pager from '$lib/components/utils/Pager.svelte';
	import ClientForm from '$lib/components/Clients/ClientForm.svelte';
	import type { ClientFieldValues } from '$lib/types/clientFields';
	import { formatCurrency } from '$lib/format';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const currency = $derived(data.therapist.currency);

	let query = $state('');
	let addOpen = $state(false);

	const CLIENTS_PER_PAGE = 15;
	let page = $state(1);

	const filtered = $derived(
		data.clients.filter(
			(c) =>
				c.name.toLowerCase().includes(query.toLowerCase()) ||
				(c.email ?? '').toLowerCase().includes(query.toLowerCase())
		)
	);
	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / CLIENTS_PER_PAGE)));
	const paged = $derived(filtered.slice((page - 1) * CLIENTS_PER_PAGE, page * CLIENTS_PER_PAGE));

	// jump back to page 1 only when the search itself changes, not on every data reload
	$effect(() => {
		query;
		page = 1;
	});

	// keep page in range if an action (e.g. delete) shrinks the result set
	$effect(() => {
		if (page > totalPages) page = totalPages;
	});

	function toneFor(status: string): 'success' | 'warning' | 'danger' {
		if (status === 'active') return 'success';
		if (status === 'paused') return 'warning';
		return 'danger';
	}

	// New client draft
	let newName = $state('');
	let newEmail = $state('');
	let newRate = $state('');
	let newCustomFields = $state<ClientFieldValues>({});

	function openAdd() {
		newName = '';
		newEmail = '';
		newRate = '';
		newCustomFields = {};
		addOpen = true;
	}

</script>

<div class="clients">
	<div class="header">
		<div>
			<div class="title">Clients</div>
			<div class="subtitle">{data.clients.length} on file · {filtered.length} shown</div>
		</div>
		<Button variant="pop" onclick={openAdd}>+ Add client</Button>
	</div>

	<Input placeholder="Search by name or email" bind:value={query} />

	{#if form?.inviteUrl}
		<div class="banner" class:form-error={Boolean(form.message)}>
			{#if form.message}
				<div>{form.message}</div>
			{/if}
			Invite link: <code>{form.inviteUrl}</code>
		</div>
	{:else if form?.message && !addOpen}
		<div class="banner form-error">{form.message}</div>
	{/if}

	<div class="list">
		{#each paged as c (c.id)}
			<Card>
				<div class="card-row">
					<Avatar name={c.name} size={38} />
					<div class="info">
						<div class="name-row">
							<div class="name">{c.name}</div>
							<Badge tone={toneFor(c.status)}>{c.status}</Badge>
							{#if c.userId}
								<span class="joined">Portal access</span>
							{:else if c.inviteToken}
								<span class="pending">Invite pending</span>
							{/if}
						</div>
						<div class="detail-row">
							<div class="email">{c.email}</div>
							{#if c.rate}
								<div class="rate">{formatCurrency(c.rate, currency)} / session</div>
							{/if}
						</div>
						<div class="tag-row">
							{#each c.tags as t (t)}
								<Tag>{t}</Tag>
							{/each}
						</div>
					</div>
					<div class="actions">
						<Button href={`/clients/${c.id}`} variant="secondary" size="sm">View</Button>
						{#if !c.userId}
							<form method="POST" action="?/resendInvite" use:enhance>
								<input type="hidden" name="clientId" value={c.id} />
								<Button type="submit" variant="secondary" size="sm">
									{c.inviteToken ? 'Resend invite' : 'Invite'}
								</Button>
							</form>
						{/if}
						<form
							method="POST"
							action="?/delete"
							use:enhance={({ cancel }) => {
								if (!confirm(`Permanently delete ${c.name}?`)) cancel();
							}}
						>
							<input type="hidden" name="clientId" value={c.id} />
							<Button type="submit" variant="secondary" size="sm">Delete</Button>
						</form>
					</div>
				</div>
			</Card>
		{/each}
		{#if filtered.length === 0}
			<div class="empty">No clients match that search.</div>
		{/if}
	</div>
	<Pager {page} {totalPages} ongoto={(target) => (page = target)} />
</div>

<Dialog
	open={addOpen}
	title="Add a client"
	width="clamp(280px, 26vw, 380px)"
	onclose={() => (addOpen = false)}
>
	<form
		class="dialog-form"
		method="POST"
		action="?/add"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') addOpen = false;
				await update();
			};
		}}
	>
		<div class="hint">
			Your client fills in their own age, address, phone number and gender when they accept the
			invite, so you don't need to add fields for those.
		</div>
		<ClientForm
			bind:name={newName}
			bind:email={newEmail}
			bind:rate={newRate}
			bind:customFields={newCustomFields}
			fieldHeadings={data.fieldHeadings}
			showDetails={false}
			errors={form?.fieldErrors ?? {}}
		/>
		{#if form?.message}
			<div class="form-error">{form.message}</div>
		{/if}
		<Button type="submit" variant="primary">Add & invite client</Button>
	</form>
</Dialog>

<style>
	.clients {
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 860px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 10px;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(24px, 5vw, 32px);
		color: var(--text-primary);
	}

	.subtitle {
		font-size: 13px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	.banner {
		padding: 10px 14px;
		border-radius: var(--radius-md, 8px);
		font-size: 13px;
		background: var(--citrus-300);
		border: 2px dashed var(--citrus-600);
		color: var(--text-secondary);
		word-break: break-all;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.card-row {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		flex-wrap: wrap;
	}

	.info {
		flex: 1;
		min-width: 150px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.name {
		font-weight: 700;
		color: var(--text-primary);
	}

	.joined {
		font-size: 11px;
		font-weight: 700;
		color: var(--success);
	}

	.pending {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
	}

	.detail-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}

	.email {
		font-size: 13px;
		color: var(--text-muted);
	}

	.rate {
		font-size: 13px;
		color: var(--text-muted);
	}

	.rate::before {
		content: '·';
		margin-right: 8px;
	}

	.tag-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	/* On phones the button cluster gets its own full-width row, all 3 buttons across it */
	@media (max-width: 640px) {
		.actions {
			width: 100%;
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 6px;
		}

		.actions form {
			display: contents;
		}

		.actions :global(.btn) {
			width: 100%;
		}
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}

	.dialog-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
	}

	.hint {
		font-size: 13px;
		color: var(--text-secondary);
	}
</style>
