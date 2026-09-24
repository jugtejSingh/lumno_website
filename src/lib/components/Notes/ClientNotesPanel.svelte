<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Card from '$lib/components/utils/Card.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import NoteEditor from '$lib/components/Notes/NoteEditor.svelte';
	import ClientNotesChat from '$lib/components/Notes/ClientNotesChat.svelte';

	type NoteRow = {
		id: string;
		appointmentId: string | null;
		visibility: 'private' | 'shared';
		body: string;
		description: string | null;
		createdAt: Date;
		sessionLabel: string | null;
	};

	let {
		client,
		sessions,
		form
	}: {
		client: { id: string; name: string; notes: NoteRow[]; sharedNotes: NoteRow[] };
		sessions: { id: string; when: string }[];
		form: { message?: string } | null | undefined;
	} = $props();

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

	const writing = $derived(writingType !== null);

	const NOTES_PER_PAGE = 3;
	let privatePage = $state(1);
	let sharedPage = $state(1);

	// writing / cancelling starts each list back at page 1
	$effect(() => {
		writingType;
		privatePage = 1;
		sharedPage = 1;
	});

	// switching which client this panel shows resets any in-progress editor state
	// svelte-ignore state_referenced_locally
	let lastClientId = client.id;
	$effect(() => {
		if (client.id === lastClientId) return;
		lastClientId = client.id;
		writingType = null;
		editingNoteId = '';
		expandedNoteIds = new Set();
		chatOpen = false;
	});

	const privateTotalPages = $derived(Math.max(1, Math.ceil(client.notes.length / NOTES_PER_PAGE)));
	const pagedPrivateNotes = $derived(
		client.notes.slice((privatePage - 1) * NOTES_PER_PAGE, privatePage * NOTES_PER_PAGE)
	);
	const sharedTotalPages = $derived(Math.max(1, Math.ceil(client.sharedNotes.length / NOTES_PER_PAGE)));
	const pagedSharedNotes = $derived(
		client.sharedNotes.slice((sharedPage - 1) * NOTES_PER_PAGE, sharedPage * NOTES_PER_PAGE)
	);
	const isSharedWriting = $derived(writingType === 'shared');
	const todayLabel = new Date().toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

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

	function startEdit(n: NoteRow) {
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
	function shareNoteSubmit(n: NoteRow) {
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
		return async ({
			result,
			update
		}: {
			result: import('@sveltejs/kit').ActionResult;
			update: () => Promise<void>;
		}) => {
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

<div class="panel" class:writing>
	{#if writing}
		<form method="POST" action={formAction} bind:this={saveForm} use:enhance={saveNoteSubmit}>
			<input type="hidden" name="clientId" value={client.id} />
			<input type="hidden" name="noteId" value={editingNoteId} />
			<input type="hidden" name="visibility" value={writingType} />
			<input type="hidden" name="body" value={draftBody} />
			<input type="hidden" name="appointmentId" value={draftAppointmentId} />
			<input type="hidden" name="description" value={draftDescription} />
			<NoteEditor
				todayLabel={editorDateLabel}
				subtitle={isSharedWriting ? `Visible to ${client.name} in their portal` : 'Private — only you see this'}
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
					{#if client.notes.length === 0}
						<div class="empty">No private notes yet for {client.name}.</div>
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
				<div class="section-hint">{client.name} sees these in their portal.</div>
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
					{#if client.sharedNotes.length === 0}
						<div class="empty">Nothing shared with {client.name} yet.</div>
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

{#key client.id}
	<ClientNotesChat open={chatOpen} clientId={client.id} clientName={client.name} onclose={() => (chatOpen = false)} />
{/key}

<style>
	.panel {
		display: flex;
		flex-direction: column;
	}

	.panel.writing {
		height: calc(100vh - 160px);
	}

	.panel.writing form {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
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
