<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/utils/Button.svelte';
	import { renderMarkdown } from '$lib/markdown';

	let {
		open,
		clientId,
		clientName,
		onclose
	}: {
		open: boolean;
		clientId: string;
		clientName: string;
		onclose: () => void;
	} = $props();

	type Message = { role: 'user' | 'assistant'; content: string };

	// in-memory only — closing the drawer or reloading the page starts the chat over
	let messages = $state<Message[]>([]);
	let question = $state('');
	let asking = $state(false);
	let errorMessage = $state('');
	let historyJson = $state('[]');
	let scrollEl: HTMLDivElement;

	function scrollToBottom() {
		queueMicrotask(() => {
			if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
		});
	}

	function askSubmit() {
		historyJson = JSON.stringify(messages);
		const asked = question;
		messages = [...messages, { role: 'user', content: asked }];
		question = '';
		asking = true;
		errorMessage = '';
		scrollToBottom();

		return async ({ result }: { result: import('@sveltejs/kit').ActionResult }) => {
			asking = false;
			if (result.type === 'success' && result.data?.answer) {
				messages = [...messages, { role: 'assistant', content: result.data.answer as string }];
				scrollToBottom();
				return;
			}
			if (result.type === 'failure') {
				errorMessage = (result.data?.message as string) ?? 'Could not get an answer.';
				return;
			}
			errorMessage = 'Could not get an answer.';
		};
	}
</script>

{#if open}
	<div class="backdrop" role="presentation" onclick={onclose}></div>
	<div class="drawer" role="dialog" aria-modal="true" aria-label={`Chat about ${clientName}`}>
		<div class="drawer-header">
			<div class="drawer-title">Ask about {clientName}</div>
			<button type="button" class="drawer-close" onclick={onclose} aria-label="Close">&times;</button>
		</div>

		<div class="messages" bind:this={scrollEl}>
			{#if messages.length === 0}
				<div class="empty">Ask anything about {clientName} — answers come only from their private notes.</div>
			{/if}
			{#each messages as m, i (i)}
				{#if m.role === 'assistant'}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in renderMarkdown -->
					<div class="bubble bubble-assistant">{@html renderMarkdown(m.content)}</div>
				{:else}
					<div class="bubble bubble-user">{m.content}</div>
				{/if}
			{/each}
			{#if asking}
				<div class="bubble bubble-assistant">Thinking…</div>
			{/if}
		</div>

		{#if errorMessage}
			<div class="error">{errorMessage}</div>
		{/if}

		<form method="POST" action="?/chat" use:enhance={askSubmit} class="ask-form">
			<input type="hidden" name="clientId" value={clientId} />
			<input type="hidden" name="history" value={historyJson} />
			<input
				type="text"
				name="question"
				bind:value={question}
				placeholder="Ask a question…"
				disabled={asking}
			/>
			<Button type="submit" size="sm" disabled={asking || !question.trim()}>Send</Button>
		</form>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgb(53 25 14 / 0.35);
		z-index: 100;
	}

	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 50%;
		max-width: 640px;
		background: var(--surface-card);
		border-left: 2px solid var(--outline);
		box-shadow: var(--shadow-lg);
		z-index: 101;
		display: flex;
		flex-direction: column;
	}

	@media (max-width: 720px) {
		.drawer {
			width: 90%;
			max-width: none;
		}
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 12px 10px 18px;
		background-color: var(--coral-400);
		border-bottom: 2px solid var(--outline);
	}

	.drawer-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 18px;
		color: var(--text-primary);
	}

	.drawer-close {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border: 2px solid var(--outline);
		border-radius: var(--radius-xs);
		background: var(--plum-300);
		box-shadow: var(--shadow-xs);
		font-size: 18px;
		font-weight: 700;
		line-height: 1;
		color: var(--text-primary);
		cursor: pointer;
		padding: 0;
	}

	.messages {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.empty {
		color: var(--text-muted);
		font-size: 14px;
	}

	.bubble {
		max-width: 85%;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: 14px;
		line-height: var(--lh-relaxed);
	}

	.bubble-user {
		align-self: flex-end;
		background: var(--accent-primary);
		color: var(--text-on-accent);
		white-space: pre-wrap;
	}

	.bubble-assistant {
		align-self: flex-start;
		background: var(--beige-200);
		color: var(--text-primary);
	}

	/* markdown output: trim the default top/bottom margins so a short reply doesn't
	   look padded inside the bubble */
	.bubble-assistant :global(> :first-child) {
		margin-top: 0;
	}

	.bubble-assistant :global(> :last-child) {
		margin-bottom: 0;
	}

	.error {
		color: var(--danger, #b3261e);
		font-size: 13px;
		padding: 0 16px;
	}

	.ask-form {
		display: flex;
		gap: 8px;
		padding: 12px 16px;
		border-top: 2px solid var(--outline);
	}

	.ask-form input[type='text'] {
		flex: 1;
		min-width: 0;
		padding: 8px 12px;
		border: 2px solid var(--outline);
		border-radius: var(--radius-sm);
		font-family: var(--font-body);
		font-size: 14px;
	}
</style>
