<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import ClientForm from '$lib/components/Clients/ClientForm.svelte';
	import PaymentHistoryList from '$lib/components/Payments/PaymentHistoryList.svelte';
	import { formatCurrency } from '$lib/format';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const currency = $derived(data.therapist.currency);
	const statusOptions = ['active', 'paused', 'left'];

	let query = $state('');
	let addOpen = $state(false);
	let historyClientId = $state<string | null>(null);
	const historyClientName = $derived(data.clients.find((c) => c.id === historyClientId)?.name ?? '');

	const filtered = $derived(
		data.clients.filter(
			(c) =>
				c.name.toLowerCase().includes(query.toLowerCase()) ||
				(c.email ?? '').toLowerCase().includes(query.toLowerCase())
		)
	);

	function toneFor(status: string): 'success' | 'warning' | 'danger' {
		if (status === 'active') return 'success';
		if (status === 'paused') return 'warning';
		return 'danger';
	}

	// New client draft
	let newName = $state('');
	let newEmail = $state('');
	let newAge = $state('');
	let newRate = $state('');
	let newBio = $state('');
	let newTags = $state<string[]>([]);

	function openAdd() {
		newName = '';
		newEmail = '';
		newAge = '';
		newRate = '';
		newBio = '';
		newTags = [];
		addOpen = true;
	}

	// Edit client draft
	let editClientId = $state<string | null>(null);
	let editName = $state('');
	let editAge = $state('');
	let editRate = $state('');
	let editBio = $state('');
	let editTags = $state<string[]>([]);
	let editStatus = $state('');

	function openEdit(c: (typeof data.clients)[number]) {
		editClientId = c.id;
		editName = c.name;
		editAge = c.age?.toString() ?? '';
		editRate = c.rate?.toString() ?? '';
		editBio = c.bio ?? '';
		editTags = [...c.tags];
		editStatus = c.status;
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
		<div class="banner">Invite link: <code>{form.inviteUrl}</code></div>
	{:else if form?.message && !addOpen && !editClientId}
		<div class="banner form-error">{form.message}</div>
	{/if}

	<div class="list">
		{#each filtered as c (c.id)}
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
						<div class="email">{c.email}</div>
						{#if c.rate}
							<div class="rate">{formatCurrency(c.rate, currency)} / session</div>
						{/if}
						<div class="tag-row">
							{#each c.tags as t (t)}
								<Tag>{t}</Tag>
							{/each}
						</div>
					</div>
					<div class="actions">
						<Button variant="secondary" size="sm" onclick={() => (historyClientId = c.id)}>
							View payments
						</Button>
						<Button variant="secondary" size="sm" onclick={() => openEdit(c)}>Edit</Button>
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
</div>

<Dialog open={addOpen} title="Add a client" onclose={() => (addOpen = false)}>
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
		<ClientForm
			bind:name={newName}
			bind:email={newEmail}
			bind:age={newAge}
			bind:rate={newRate}
			bind:bio={newBio}
			bind:tags={newTags}
			errors={form?.fieldErrors ?? {}}
		/>
		{#if form?.message}
			<div class="form-error">{form.message}</div>
		{/if}
		<Button type="submit" variant="primary">Add & invite client</Button>
	</form>
</Dialog>

<Dialog open={!!editClientId} title="Edit client" onclose={() => (editClientId = null)}>
	<form
		class="dialog-form"
		method="POST"
		action="?/update"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') editClientId = null;
				await update();
			};
		}}
	>
		<input type="hidden" name="clientId" value={editClientId} />
		<ClientForm
			bind:name={editName}
			bind:age={editAge}
			bind:rate={editRate}
			bind:bio={editBio}
			bind:tags={editTags}
			bind:status={editStatus}
			showEmail={false}
			{statusOptions}
			errors={form?.fieldErrors ?? {}}
		/>
		{#if form?.message}
			<div class="form-error">{form.message}</div>
		{/if}
		<Button type="submit" variant="primary">Save changes</Button>
	</form>
</Dialog>

<Dialog
	open={!!historyClientId}
	title={historyClientId ? `${historyClientName} — payment history` : ''}
	onclose={() => (historyClientId = null)}
>
	{#if historyClientId}
		<div class="history-dialog">
			<PaymentHistoryList clientId={historyClientId} {currency} />
		</div>
	{/if}
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
	}

	.title {
		font-family: var(--font-display);
		font-size: 32px;
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
		background: var(--beige-200);
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
		align-items: center;
		gap: 14px;
	}

	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 8px;
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

	.email {
		font-size: 13px;
		color: var(--text-muted);
	}

	.rate {
		font-size: 13px;
		color: var(--text-muted);
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
		flex-shrink: 0;
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}

	.dialog-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 340px;
	}

	.history-dialog {
		width: 420px;
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
	}
</style>
