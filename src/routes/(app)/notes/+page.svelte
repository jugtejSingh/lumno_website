<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';
	import { enhance } from '$lib/enhance';
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import ClientList from '$lib/components/Notes/ClientList.svelte';
	import NoteEditor from '$lib/components/Notes/NoteEditor.svelte';
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// svelte-ignore state_referenced_locally
	const wantedClient = data.clients.find((c) => c.name === page.url.searchParams.get('client'));
	// svelte-ignore state_referenced_locally
	let selectedId = $state(wantedClient?.id ?? data.clients[0]?.id);
	let query = $state('');
	let writingType = $state<'private' | 'shared' | null>(null);
	let draftBody = $state('');
	let draftAppointmentId = $state('');

	const selected = $derived(data.clients.find((c) => c.id === selectedId) ?? data.clients[0]);
	const sessions = $derived(data.sessionsByClient[selectedId] ?? []);
	const writing = $derived(writingType !== null);
	const isSharedWriting = $derived(writingType === 'shared');
	const todayLabel = new Date().toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	function select(id: string) {
		selectedId = id;
	}

	function startPrivate() {
		draftBody = '';
		draftAppointmentId = '';
		writingType = 'private';
	}

	function startShared() {
		draftBody = '';
		draftAppointmentId = '';
		writingType = 'shared';
	}

	function cancelWriting() {
		writingType = null;
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
			<div class="detail-inner" class:writing>
				<div class="client-head">
					<Avatar name={selected.name} size={40} />
					<div>
						<div class="client-name">{selected.name}</div>
						<div class="client-meta">
							{selected.notes.length} private · {selected.sharedNotes.length} shared with client
						</div>
					</div>
				</div>

				{#if writing}
					<form
						method="POST"
						action="?/addNote"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') writingType = null;
								await update();
							};
						}}
					>
						<input type="hidden" name="clientId" value={selected.id} />
						<input type="hidden" name="visibility" value={writingType} />
						<input type="hidden" name="body" value={draftBody} />
						<input type="hidden" name="appointmentId" value={draftAppointmentId} />
						<NoteEditor
							{todayLabel}
							subtitle={isSharedWriting
								? `Visible to ${selected.name} in their portal`
								: 'Private — only you see this'}
							placeholder={isSharedWriting
								? 'Write the note or homework for your client…'
								: "Write today's private note here…"}
							shared={isSharedWriting}
							saveLabel={isSharedWriting ? 'Send to client' : 'Save note'}
							{sessions}
							bind:body={draftBody}
							bind:appointmentId={draftAppointmentId}
							oncancel={cancelWriting}
						/>
						{#if form?.message}
							<div class="form-error">{form.message}</div>
						{/if}
					</form>
				{:else}
					<div class="sections">
						<div class="section">
							<div class="section-head">
								<div class="section-title">Private notes</div>
								<Button size="sm" variant="secondary" onclick={startPrivate}>New note</Button>
							</div>
							<div class="section-hint">Only you can see these.</div>
							<div class="notes-list">
								{#each selected.notes as n (n.id)}
									<Card>
										<div class="shared-head">
											<div class="note-date">
												{n.createdAt.toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric'
												})}
											</div>
											{#if n.sessionLabel}
												<Tag color="plum">Session: {n.sessionLabel}</Tag>
											{/if}
										</div>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in renderMarkdown -->
										<div class="note-body">{@html renderMarkdown(n.body)}</div>
									</Card>
								{/each}
								{#if selected.notes.length === 0}
									<div class="empty">No private notes yet for {selected.name}.</div>
								{/if}
							</div>
						</div>

						<div class="section">
							<div class="section-head">
								<div class="section-title">Sent to client</div>
								<Button size="sm" variant="pop" onclick={startShared}>New for client</Button>
							</div>
							<div class="section-hint">{selected.name} sees these in their portal.</div>
							<div class="notes-list">
								{#each selected.sharedNotes as n (n.id)}
									<Card>
										<div class="shared-head">
											<div class="note-date">
												{n.createdAt.toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric'
												})}
											</div>
											<div class="shared-tags">
												{#if n.sessionLabel}
													<Tag color="plum">Session: {n.sessionLabel}</Tag>
												{/if}
												<Tag color="sage">Visible to client</Tag>
											</div>
										</div>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in renderMarkdown -->
										<div class="note-body">{@html renderMarkdown(n.body)}</div>
									</Card>
								{/each}
								{#if selected.sharedNotes.length === 0}
									<div class="empty">Nothing shared with {selected.name} yet.</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}
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

	.detail-inner.writing {
		height: calc(100vh - 160px);
	}

	.detail-inner.writing form {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.client-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.client-name {
		font-family: var(--font-display);
		font-size: clamp(22px, 5vw, 26px);
		color: var(--text-primary);
	}

	.client-meta {
		font-size: 13px;
		color: var(--text-muted);
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 10px;
	}

	.section-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.section-hint {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 10px;
	}

	.notes-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.note-date {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 6px;
	}

	.shared-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 6px;
	}

	.shared-tags {
		display: flex;
		gap: 6px;
	}

	.shared-head .note-date {
		margin-bottom: 0;
	}

	.note-body {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
		margin-top: 8px;
	}
</style>
