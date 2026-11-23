<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import AnswerList from '$lib/components/Intake/AnswerList.svelte';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const response = $derived(data.response);
	const heading = $derived(response.name ?? response.email ?? 'Anonymous response');
	const submittedOn = $derived(
		response.createdAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
	);

	let confirmingDelete = $state(false);
</script>

<svelte:head>
	<title>Intake response</title>
</svelte:head>

<div class="page">
	<div><a class="back" href="/intake">← Back to intake</a></div>

	<Card>
		<div class="header">
			<div>
				<h1 class="title">{heading}</h1>
				<div class="meta">
					{#if response.name && response.email}{response.email} · {/if}Sent {submittedOn}
				</div>
			</div>
			<div class="actions">
				{#if response.clientId}
					<Button variant="secondary" size="sm" href="/clients/{response.clientId}">View client</Button>
				{:else if response.email}
					<form method="POST" action="?/import" use:enhance>
						<Button type="submit" size="sm">Import as client</Button>
					</form>
				{/if}
			</div>
		</div>

		{#if !response.clientId && !response.email}
			<div class="helper">No email was collected, so this response can't be imported as a client.</div>
		{/if}
		{#if form?.message}
			<div class="notice" role="alert">{form.message}</div>
		{/if}
		{#if form && 'inviteUrl' in form && form.inviteUrl}
			<input class="link-input" readonly value={form.inviteUrl} aria-label="Invite link" />
		{/if}
	</Card>

	<Card>
		<AnswerList questions={response.questionsSnapshot} answers={response.answers} />
	</Card>

	<div class="delete">
		{#if confirmingDelete}
			<form method="POST" action="?/delete" class="confirm" use:enhance>
				<span class="helper">Delete this response for good?</span>
				<Button type="submit" variant="secondary" size="sm">Yes, delete</Button>
				<Button variant="secondary" size="sm" onclick={() => (confirmingDelete = false)}>Cancel</Button>
			</form>
		{:else}
			<Button variant="secondary" size="sm" onclick={() => (confirmingDelete = true)}>
				Delete response
			</Button>
		{/if}
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 760px;
	}

	.back {
		font-size: 14px;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		flex-wrap: wrap;
	}

	.title {
		font-family: var(--font-display);
		font-size: 22px;
		color: var(--text-primary);
		margin: 0;
		overflow-wrap: anywhere;
	}

	.meta {
		font-size: 13px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.helper {
		font-size: 13px;
		color: var(--text-secondary);
		margin-top: 8px;
	}

	.notice {
		font-size: 13px;
		color: var(--danger);
		margin-top: 12px;
	}

	.link-input {
		width: 100%;
		box-sizing: border-box;
		margin-top: 8px;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 8px 10px;
	}

	.confirm {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.confirm .helper {
		margin-top: 0;
	}
</style>
