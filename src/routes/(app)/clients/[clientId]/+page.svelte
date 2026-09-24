<script lang="ts">
	import { goto } from '$app/navigation';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import ClientSidebar from '$lib/components/Payments/ClientSidebar.svelte';
	import ClientForm from '$lib/components/Clients/ClientForm.svelte';
	import ClientProfileDetails from '$lib/components/Clients/ClientProfileDetails.svelte';
	import ClientSessionsList from '$lib/components/Clients/ClientSessionsList.svelte';
	import PaymentHistoryList from '$lib/components/Payments/PaymentHistoryList.svelte';
	import ClientResources from '$lib/components/Resources/ClientResources.svelte';
	import ClientNotesPanel from '$lib/components/Notes/ClientNotesPanel.svelte';
	import { enhance } from '$lib/enhance';
	import { formatCurrency } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const statusOptions = ['active', 'paused', 'left'];

	type Tab = 'info' | 'sessions' | 'payments' | 'notes' | 'resources';
	let tab = $state<Tab>('info');

	// edit-form drafts, reset whenever the client we're viewing changes (sidebar
	// navigation keeps this component mounted, it just gets new `data`)
	// svelte-ignore state_referenced_locally
	let editName = $state(data.client.name);
	// svelte-ignore state_referenced_locally
	let editRate = $state(data.client.rate?.toString() ?? '');
	// svelte-ignore state_referenced_locally
	let editCustomFields = $state({ ...data.client.customFields });
	// svelte-ignore state_referenced_locally
	let editTags = $state([...data.client.tags]);
	// svelte-ignore state_referenced_locally
	let editStatus = $state(data.client.status);

	let paymentTotals = $state({ owed: 0, paidThisMonth: 0, paidThisYear: 0 });
	let historyList: { refresh: () => void } | undefined = $state();

	// svelte-ignore state_referenced_locally
	let lastClientId = data.client.id;
	$effect(() => {
		if (data.client.id === lastClientId) return;
		lastClientId = data.client.id;
		editName = data.client.name;
		editRate = data.client.rate?.toString() ?? '';
		editCustomFields = { ...data.client.customFields };
		editTags = [...data.client.tags];
		editStatus = data.client.status;
		tab = 'info';
		paymentTotals = { owed: 0, paidThisMonth: 0, paidThisYear: 0 };
	});

	function toneFor(status: string): 'success' | 'warning' | 'danger' {
		if (status === 'active') return 'success';
		if (status === 'paused') return 'warning';
		return 'danger';
	}
</script>

<div class="client-page">
	<ClientSidebar
		clients={data.clients}
		selectedClientId={data.client.id}
		onselect={(id) => goto(`/clients/${id}`)}
	/>

	<div class="detail">
		<div class="head">
			<Avatar name={data.client.name} size={44} />
			<div>
				<div class="name-row">
					<div class="name">{data.client.name}</div>
					<Badge tone={toneFor(data.client.status)}>{data.client.status}</Badge>
				</div>
				<div class="email">{data.client.email}</div>
			</div>
		</div>

		{#if form?.inviteUrl}
			<div class="banner" class:form-error={Boolean(form.message)}>
				{#if form.message}
					<div>{form.message}</div>
				{/if}
				Invite link: <code>{form.inviteUrl}</code>
			</div>
		{:else if form?.message}
			<div class="banner form-error">{form.message}</div>
		{/if}

		<div class="tabs">
			<button type="button" class="tab" class:active={tab === 'info'} onclick={() => (tab = 'info')}>
				Info
			</button>
			<button type="button" class="tab" class:active={tab === 'sessions'} onclick={() => (tab = 'sessions')}>
				Sessions
			</button>
			<button type="button" class="tab" class:active={tab === 'payments'} onclick={() => (tab = 'payments')}>
				Payments
			</button>
			<button type="button" class="tab" class:active={tab === 'notes'} onclick={() => (tab = 'notes')}>
				Notes
			</button>
			<button type="button" class="tab" class:active={tab === 'resources'} onclick={() => (tab = 'resources')}>
				Resources
			</button>
		</div>

		<div class="tab-panel">
			{#if tab === 'info'}
				<div class="info-actions">
					{#if !data.client.userId}
						<form method="POST" action="?/resendInvite" use:enhance>
							<Button type="submit" variant="secondary" size="sm">
								{data.client.inviteToken ? 'Resend invite' : 'Invite'}
							</Button>
						</form>
					{/if}
					<form
						method="POST"
						action="?/delete"
						use:enhance={({ cancel }) => {
							if (!confirm(`Permanently delete ${data.client.name}?`)) cancel();
						}}
					>
						<Button type="submit" variant="secondary" size="sm">Delete client</Button>
					</form>
				</div>

				<ClientProfileDetails
					phone={data.client.phone}
					dateOfBirth={data.client.dateOfBirth}
					gender={data.client.gender}
					city={data.client.city}
					state={data.client.state}
					country={data.client.country}
				/>

				<form
					class="edit-form"
					method="POST"
					action="?/update"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<ClientForm
						bind:name={editName}
						bind:rate={editRate}
						bind:customFields={editCustomFields}
						fieldHeadings={data.fieldHeadings}
						bind:tags={editTags}
						bind:status={editStatus}
						showEmail={false}
						{statusOptions}
						errors={form?.fieldErrors ?? {}}
					/>
					<Button type="submit" variant="primary">Save changes</Button>
				</form>
			{:else if tab === 'sessions'}
				<ClientSessionsList upcoming={data.upcomingSessions} past={data.pastSessions} />
			{:else if tab === 'payments'}
				<div class="payments-tab">
					<div class="stat-row">
						<div class="stat">
							<div class="stat-label">Owed</div>
							<div class="stat-value">{formatCurrency(paymentTotals.owed, data.currency)}</div>
						</div>
						<div class="stat">
							<div class="stat-label">Paid this month</div>
							<div class="stat-value">{formatCurrency(paymentTotals.paidThisMonth, data.currency)}</div>
						</div>
						<div class="stat">
							<div class="stat-label">Paid this year</div>
							<div class="stat-value">{formatCurrency(paymentTotals.paidThisYear, data.currency)}</div>
						</div>
					</div>

					<PaymentHistoryList
						bind:this={historyList}
						clientId={data.client.id}
						currency={data.currency}
						editable
						ontotals={(t) => (paymentTotals = t)}
					/>

					<form
						class="add-charge"
						method="POST"
						action="?/addCharge"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								historyList?.refresh();
							};
						}}
					>
						<Input name="amount" placeholder="Amount" />
						<Input name="note" placeholder="Note (e.g. late fee)" />
						<Button type="submit" variant="secondary" size="sm">+ Add charge</Button>
					</form>
				</div>
			{:else if tab === 'notes'}
				<ClientNotesPanel
					client={{
						id: data.client.id,
						name: data.client.name,
						notes: data.notes,
						sharedNotes: data.sharedNotes
					}}
					sessions={data.pastSessions}
					{form}
				/>
			{:else if tab === 'resources'}
				<ClientResources clientId={data.client.id} />
			{/if}
		</div>
	</div>
</div>

<style>
	.client-page {
		display: flex;
		gap: 24px;
	}

	@media (max-width: 640px) {
		.client-page {
			flex-direction: column;
			gap: 16px;
		}
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 860px;
		flex: 1;
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.name {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(20px, 4vw, 26px);
		color: var(--text-primary);
	}

	.email {
		font-size: 13px;
		color: var(--text-muted);
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

	.tabs {
		display: flex;
		gap: 4px;
		border-bottom: 2px solid var(--border-subtle);
		overflow-x: auto;
	}

	.tab {
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		padding: 8px 4px;
		margin-bottom: -2px;
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 14px;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
	}

	.tab:hover {
		color: var(--text-primary);
	}

	.tab.active {
		color: var(--text-primary);
		border-bottom-color: var(--accent-primary);
	}

	.tab-panel {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.info-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
	}

	.payments-tab {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.stat-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		border-bottom: 2px dotted var(--beige-400);
		padding-bottom: 10px;
	}

	.stat {
		min-width: 0;
	}

	.stat-label {
		font-size: 12px;
		color: var(--text-muted);
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.add-charge {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		flex-wrap: wrap;
		border-top: 2px dotted var(--beige-400);
		padding-top: 14px;
	}

	.add-charge :global(.field:first-of-type) {
		width: 110px;
	}

	.add-charge :global(.field:nth-of-type(2)) {
		flex: 1;
		min-width: 140px;
	}
</style>
