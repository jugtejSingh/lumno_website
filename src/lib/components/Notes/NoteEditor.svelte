<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';
	import Button from '$lib/components/utils/Button.svelte';

	let {
		todayLabel,
		subtitle,
		placeholder,
		shared,
		saveLabel,
		sessions,
		body = $bindable(''),
		appointmentId = $bindable(''),
		oncancel
	}: {
		todayLabel: string;
		subtitle: string;
		placeholder: string;
		shared: boolean;
		saveLabel: string;
		sessions: { id: string; when: string }[];
		body?: string;
		appointmentId?: string;
		oncancel: () => void;
	} = $props();

	let textarea: HTMLTextAreaElement;

	// wraps the current selection in markdown syntax, e.g. "text" -> "**text**"
	function wrap(before: string, after: string = before) {
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = body.slice(start, end);
		body = body.slice(0, start) + before + selected + after + body.slice(end);
		textarea.focus();
		queueMicrotask(() => textarea.setSelectionRange(start + before.length, end + before.length));
	}

	function insertListItem() {
		const start = textarea.selectionStart;
		body = body.slice(0, start) + '\n- ' + body.slice(start);
		textarea.focus();
	}
</script>

<Card>
	<div class="editor-wrap">
		<div class="editor-head">
			<div>
				<div class="today">{todayLabel}</div>
				<div class="subtitle">{subtitle}</div>
			</div>
			{#if shared}
				<Tag color="sage">Visible to client</Tag>
			{/if}
		</div>
		{#if sessions.length > 0}
			<label class="field">
				<span class="field-label">Link a session (optional)</span>
				<select class="field-input" bind:value={appointmentId}>
					<option value="">No session linked</option>
					{#each sessions as s (s.id)}
						<option value={s.id}>{s.when}</option>
					{/each}
				</select>
			</label>
		{/if}
		<div class="toolbar">
			<button type="button" onclick={() => wrap('**')}><strong>B</strong></button>
			<button type="button" onclick={() => wrap('_')}><em>I</em></button>
			<button type="button" onclick={() => wrap('### ', '')}>H</button>
			<button type="button" onclick={insertListItem}>&bull; List</button>
		</div>
		<textarea
			class="editor"
			bind:this={textarea}
			bind:value={body}
			{placeholder}
		></textarea>
		<div class="editor-footer">
			<button type="button" class="cancel" onclick={oncancel}>Cancel</button>
			<Button type="submit" variant="primary">{saveLabel}</Button>
		</div>
	</div>
</Card>

<style>
	.editor-wrap {
		display: flex;
		flex-direction: column;
		gap: 14px;
		height: 100%;
		min-height: 0;
	}

	.editor-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 4px 12px;
	}

	.today {
		font-family: var(--font-display);
		font-style: italic;
		font-size: clamp(20px, 5vw, 24px);
		color: var(--text-primary);
	}

	.subtitle {
		font-size: 13px;
		color: var(--text-muted);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.field-input {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border-subtle);
	}

	.toolbar button {
		height: 32px;
		padding: 0 10px;
		border: none;
		background: transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--text-secondary);
		font-size: 13px;
		font-family: var(--font-body);
	}

	.toolbar button:hover {
		background: var(--surface-canvas);
	}

	.editor {
		flex: 1;
		min-height: 380px;
		outline: none;
		border: none;
		resize: none;
		font-family: var(--font-body);
		font-size: 16px;
		line-height: var(--lh-relaxed);
		color: var(--text-primary);
		background: transparent;
		overflow-y: auto;
	}

	.editor-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.cancel {
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 13px;
		cursor: pointer;
		padding: 0;
	}
</style>