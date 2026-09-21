<script lang="ts">
	import { toast } from 'svelte-sonner';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { postResourceAction, uploadToS3 } from '$lib/resourceActionClient';
	import {
		MAX_RESOURCE_BYTES,
		RESOURCE_FILE_TYPES,
		RESOURCE_TAGS,
		RESOURCE_TAG_LABELS,
		type ResourceUploadTicket
	} from '$lib/types/resources';

	// Adds a file or link. Files go browser → S3 directly: ask the server for a
	// one-key upload ticket, POST the file to S3, then confirm so the row is saved.
	// clientId is only passed on the therapist side; the portal's scope comes from the session.
	let { clientId, onsaved }: { clientId?: string; onsaved: () => void } = $props();

	let kind = $state<'file' | 'link'>('file');
	let name = $state('');
	let tag = $state<string>(RESOURCE_TAGS[0]);
	let url = $state('');
	let file = $state<File | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let busy = $state(false);

	function withClient(fields: Record<string, string>): Record<string, string> {
		if (clientId) {
			fields.clientId = clientId;
		}
		return fields;
	}

	function onFileChange(event: Event & { currentTarget: HTMLInputElement }) {
		const picked = event.currentTarget.files?.[0] ?? null;
		file = picked;
		// prefill the name from the filename; the user usually renames it
		if (picked && !name) {
			name = picked.name.replace(/\.[^.]+$/, '');
		}
	}

	function reset() {
		name = '';
		url = '';
		file = null;
		if (fileInput) {
			fileInput.value = '';
		}
	}

	async function saveFile(): Promise<string | null> {
		if (!file) {
			return 'Choose a file to upload';
		}
		if (!RESOURCE_FILE_TYPES.includes(file.type)) {
			return 'Files must be a PDF, PNG, JPEG or WebP';
		}
		if (file.size > MAX_RESOURCE_BYTES) {
			return 'Files must be under 20 MB';
		}

		const ticketResult = await postResourceAction(
			'requestResourceUpload',
			withClient({ contentType: file.type, sizeBytes: String(file.size) })
		);
		if (!ticketResult.ok) {
			return ticketResult.message;
		}
		const ticket = ticketResult.data.uploadTicket as ResourceUploadTicket;

		const uploaded = await uploadToS3(ticket, file);
		if (!uploaded) {
			return 'The upload failed — please try again';
		}

		const confirmResult = await postResourceAction(
			'confirmResourceUpload',
			withClient({ key: ticket.key, name, tag })
		);
		if (!confirmResult.ok) {
			return confirmResult.message;
		}
		return null;
	}

	async function saveLink(): Promise<string | null> {
		const result = await postResourceAction('addResourceLink', withClient({ url, name, tag }));
		if (!result.ok) {
			return result.message;
		}
		return null;
	}

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) {
			return;
		}
		if (!name.trim()) {
			toast.error('Give the resource a name');
			return;
		}

		busy = true;
		let error: string | null;
		try {
			if (kind === 'file') {
				error = await saveFile();
			} else {
				error = await saveLink();
			}
		} finally {
			busy = false;
		}

		if (error) {
			toast.error(error);
			return;
		}
		toast.success('Resource saved');
		reset();
		onsaved();
	}
</script>

<form class="add-form" {onsubmit} aria-busy={busy}>
	<div class="kind-switch" role="radiogroup" aria-label="Resource type">
		<label class:active={kind === 'file'}>
			<input type="radio" bind:group={kind} value="file" /> Upload a file
		</label>
		<label class:active={kind === 'link'}>
			<input type="radio" bind:group={kind} value="link" /> Add a link
		</label>
	</div>

	{#if kind === 'file'}
		<label class="field">
			<span class="field-label">File (PDF or image, up to 20 MB)</span>
			<input
				class="field-input"
				type="file"
				accept={RESOURCE_FILE_TYPES.join(',')}
				bind:this={fileInput}
				onchange={onFileChange}
			/>
		</label>
	{:else}
		<Input label="Link" placeholder="https://…" bind:value={url} />
	{/if}

	<div class="row">
		<Input label="Name" placeholder="e.g. Sertraline prescription — Dr Rao" bind:value={name} />
		<label class="field">
			<span class="field-label">Tag</span>
			<select class="field-input" bind:value={tag}>
				{#each RESOURCE_TAGS as option (option)}
					<option value={option}>{RESOURCE_TAG_LABELS[option]}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="actions">
		<Button type="submit" size="sm">{busy ? 'Saving…' : 'Save resource'}</Button>
	</div>
</form>

<style>
	.add-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.add-form[aria-busy='true'] {
		opacity: 0.7;
	}

	.kind-switch {
		display: flex;
		gap: 8px;
	}

	.kind-switch label {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-pill);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.kind-switch label.active {
		border-color: var(--outline);
		color: var(--text-primary);
		background: var(--coral-100);
	}

	.kind-switch input {
		margin: 0;
	}

	.row {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 12px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.field-input {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-inset);
		padding: 10px 12px;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--outline);
		background: var(--coral-100);
		box-shadow: var(--shadow-focus);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	@media (max-width: 600px) {
		.row {
			grid-template-columns: 1fr;
		}

		.field-input {
			font-size: 16px;
		}
	}
</style>
