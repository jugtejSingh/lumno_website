<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Card from '$lib/components/utils/Card.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import ClientList from '$lib/components/Notes/ClientList.svelte';
	import NoteEditor from '$lib/components/Notes/NoteEditor.svelte';
	import ClientNotesChat from '$lib/components/Notes/ClientNotesChat.svelte';
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
	let draftDescription = $state('');
	// empty = writing a new note; set = editing that existing note
	let editingNoteId = $state('');
	let editingDateLabel = $state('');
	let saveForm: HTMLFormElement;
	let saveRetries = 0;
	let expandedNoteIds = $state(new Set<string>());
	let chatOpen = $state(false);

	const selected = $derived(data.clients.find((c) => c.id === selectedId) ?? data.clients[0]);
	const sessions = $derived(data.sessionsByClient[selectedId] ?? []);
	const writing = $derived(writingType !== null);

	const NOTES_PER_PAGE = 3;
	let privatePage = $state(1);
	let sharedPage = $state(1);

	// switching clients (or coming back from the editor) starts each list back at page 1
	$effect(() => {
		selectedId;
		privatePage = 1;
		sharedPage = 1;
	});

	const privateTotalPages = $derived(
		selected ? Math.max(1, Math.ceil(selected.notes.length / NOTES_PER_PAGE)) : 1
	);
	const pagedPrivateNotes = $derived(
		selected ? selected.notes.slice((privatePage - 1) * NOTES_PER_PAGE, privatePage * NOTES_PER_PAGE) : []
	);
	const sharedTotalPages = $derived(
		selected ? Math.max(1, Math.ceil(selected.sharedNotes.length / NOTES_PER_PAGE)) : 1
	);
	const pagedSharedNotes = $derived(
		selected ? selected.sharedNotes.slice((sharedPage - 1) * NOTES_PER_PAGE, sharedPage * NOTES_PER_PAGE) : []
	);
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
		draftDescription = '';
		editingNoteId = '';
		writingType = 'private';
	}

	function startShared() {
		draftBody = '';
		draftAppointmentId = '';
		draftDescription = '';
		editingNoteId = '';
		writingType = 'shared';
	}

	function startEdit(n: (typeof data.clients)[number]['notes'][number]) {
		draftBody = n.body;
		draftAppointmentId = n.appointmentId ?? '';
		draftDescription = n.description ?? '';
		editingNoteId = n.id;
		editingDateLabel = n.createdAt.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		writingType = n.visibility;
	}

	// Opens the shared editor prefilled with the AI's client-safe draft, so the
	// therapist reads it before anything reaches the client.
	let sharingNoteId = $state('');
	function shareNoteSubmit(n: (typeof data.clients)[number]['notes'][number]) {
		return async ({ result }: { result: import('@sveltejs/kit').ActionResult }) => {
			sharingNoteId = '';
			if (result.type === 'success' && result.data?.shared) {
				draftBody = result.data.shared.body;
				draftDescription = result.data.shared.description;
				draftAppointmentId = n.appointmentId ?? '';
				editingNoteId = '';
				writingType = 'shared';
				toast.message('Draft ready — check it before sending.');
				return;
			}
			if (result.type === 'failure') {
				toast.error(result.data?.message ?? 'Could not draft that for the client.');
				return;
			}
			toast.error('Could not draft that for the client.');
		};
	}

	function cancelWriting() {
		writingType = null;
		editingNoteId = '';
	}

	const editing = $derived(editingNoteId !== '');

	const formAction = $derived.by(() => {
		if (editing) {
			return '?/editNote';
		}
		return '?/addNote';
	});

	const editorDateLabel = $derived.by(() => {
		if (editing) {
			return editingDateLabel;
		}
		return todayLabel;
	});

	const editorSaveLabel = $derived.by(() => {
		if (editing) {
			return 'Save changes';
		}
		if (isSharedWriting) {
			return 'Send to client';
		}
		return 'Save note';
	});

	function excerpt(body: string) {
		const flat = body.replace(/\s+/g, ' ').trim();
		return flat.length > 80 ? flat.slice(0, 80) + '…' : flat;
	}

	function toggleExpanded(id: string) {
		const next = new Set(expandedNoteIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedNoteIds = next;
	}

	// The connection can drop mid-submit; retry a few times with backoff before
	// giving up, so a written note is never silently lost.
	const MAX_SAVE_RETRIES = 3;
	function saveNoteSubmit() {
		return async ({ result, update }: { result: import('@sveltejs/kit').ActionResult; update: () => Promise<void> }) => {
			if (result.type === 'error' && saveRetries < MAX_SAVE_RETRIES) {
				saveRetries += 1;
				toast.message(`Connection issue, retrying… (${saveRetries}/${MAX_SAVE_RETRIES})`);
				setTimeout(() => saveForm.requestSubmit(), 800 * saveRetries);
				return;
			}
			saveRetries = 0;
			if (result.type === 'error') {
				toast.error('Could not save the note after several attempts. Your writing is still here — try again.');
				return;
			}
			if (result.type === 'success') {
				writingType = null;
			}
			await update();
		};
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
						action={formAction}
						bind:this={saveForm}
						use:enhance={saveNoteSubmit}
					>
						<input type="hidden" name="clientId" value={selected.id} />
						<input type="hidden" name="noteId" value={editingNoteId} />
						<input type="hidden" name="visibility" value={writingType} />
						<input type="hidden" name="body" value={draftBody} />
						<input type="hidden" name="appointmentId" value={draftAppointmentId} />
						<input type="hidden" name="description" value={draftDescription} />
						<NoteEditor
							todayLabel={editorDateLabel}
							subtitle={isSharedWriting
								? `Visible to ${selected.name} in their portal`
								: 'Private — only you see this'}
							placeholder={isSharedWriting
								? 'Write the note or homework for your client…'
								: "Write today's private note here…"}
							shared={isSharedWriting}
							saveLabel={editorSaveLabel}
							{sessions}
							bind:body={draftBody}
							bind:appointmentId={draftAppointmentId}
							bind:description={draftDescription}
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
								<div class="section-head-actions">
									<Button size="sm" variant="secondary" onclick={() => (chatOpen = true)}>Chat</Button>
									<Button size="sm" variant="secondary" onclick={startPrivate}>New note</Button>
								</div>
							</div>
							<div class="section-hint">Only you can see these.</div>
							<div class="notes-list">
								{#each pagedPrivateNotes as n (n.id)}
									<Card>
										<button type="button" class="note-toggle" onclick={() => toggleExpanded(n.id)}>
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
											<div class="note-summary">{n.description ?? excerpt(n.body)}</div>
										</button>
										{#if expandedNoteIds.has(n.id)}
											<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in renderMarkdown -->
											<div class="note-body">{@html renderMarkdown(n.body)}</div>
											<div class="note-actions">
												<Button size="sm" variant="secondary" onclick={() => startEdit(n)}>Edit</Button>
												<form
													method="POST"
													action="?/shareNote"
													use:enhance={() => {
														sharingNoteId = n.id;
														return shareNoteSubmit(n);
													}}
												>
													<input type="hidden" name="body" value={n.body} />
													<Button size="sm" variant="pop" type="submit" disabled={sharingNoteId === n.id}>
														{sharingNoteId === n.id ? 'Drafting…' : 'Send to client'}
													</Button>
												</form>
											</div>
										{/if}
									</Card>
								{/each}
								{#if selected.notes.length === 0}
									<div class="empty">No private notes yet for {selected.name}.</div>
								{/if}
							</div>
							{#if privateTotalPages > 1}
								<div class="pager">
									<Button
										variant="secondary"
										size="sm"
										onclick={() => {
											if (privatePage > 1) privatePage -= 1;
										}}>Prev</Button
									>
									<span class="pager-label">Page {privatePage} of {privateTotalPages}</span>
									<Button
										variant="secondary"
										size="sm"
										onclick={() => {
											if (privatePage < privateTotalPages) privatePage += 1;
										}}>Next</Button
									>
								</div>
							{/if}
						</div>

						<div class="section">
							<div class="section-head">
								<div class="section-title">Sent to client</div>
								<Button size="sm" variant="pop" onclick={startShared}>New for client</Button>
							</div>
							<div class="section-hint">{selected.name} sees these in their portal.</div>
							<div class="notes-list">
								{#each pagedSharedNotes as n (n.id)}
									<Card>
										<button type="button" class="note-toggle" onclick={() => toggleExpanded(n.id)}>
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
											<div class="note-summary">{n.description ?? excerpt(n.body)}</div>
										</button>
										{#if expandedNoteIds.has(n.id)}
											<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in renderMarkdown -->
											<div class="note-body">{@html renderMarkdown(n.body)}</div>
											<div class="note-actions">
												<Button size="sm" variant="secondary" onclick={() => startEdit(n)}>Edit</Button>
											</div>
										{/if}
									</Card>
								{/each}
								{#if selected.sharedNotes.length === 0}
									<div class="empty">Nothing shared with {selected.name} yet.</div>
								{/if}
							</div>
							{#if sharedTotalPages > 1}
								<div class="pager">
									<Button
										variant="secondary"
										size="sm"
										onclick={() => {
											if (sharedPage > 1) sharedPage -= 1;
										}}>Prev</Button
									>
									<span class="pager-label">Page {sharedPage} of {sharedTotalPages}</span>
									<Button
										variant="secondary"
										size="sm"
										onclick={() => {
											if (sharedPage < sharedTotalPages) sharedPage += 1;
										}}>Next</Button
									>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if selected}
	{#key selected.id}
		<ClientNotesChat
			open={chatOpen}
			clientId={selected.id}
			clientName={selected.name}
			onclose={() => (chatOpen = false)}
		/>
	{/key}
{/if}

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
		font-weight: 600;
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

	.section-head-actions {
		display: flex;
		gap: 8px;
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

	.note-toggle {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
	}

	.note-summary {
		font-size: 14px;
		color: var(--text-secondary);
	}

	.note-body {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin-top: 10px;
		padding-top: 10px;
		border-top: 2px dotted var(--beige-400);
	}

	.note-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 10px;
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-top: 12px;
	}

	.pager-label {
		font-size: 13px;
		color: var(--text-muted);
	}

	.form-error {
		color: var(--danger, #b3261e);
		font-size: 13px;
		margin-top: 8px;
	}
</style>
