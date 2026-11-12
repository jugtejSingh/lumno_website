<script lang="ts">
	import Button from '$lib/components/utils/Button.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import { enhance } from '$lib/enhance';

	// Email the invoice PDF. "Send to" is required and editable: it starts as the
	// client's billing email (else their email), blank for one-off invoices.
	let {
		defaultTo,
		sentTo,
		sentAt,
		error,
		emailedTo
	}: {
		defaultTo: string;
		sentTo: string | null;
		sentAt: Date | null;
		error?: string;
		emailedTo?: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	let to = $state(defaultTo);
	let sending = $state(false);

	function formatSentAt(value: Date): string {
		return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
			value
		);
	}
</script>

<form
	method="POST"
	action="?/email"
	class="email-form"
	use:enhance={() => {
		sending = true;
		return async ({ update }) => {
			await update({ reset: false });
			sending = false;
		};
	}}
>
	<div class="field">
		<Input label="Send to" type="email" name="to" bind:value={to} {error} />
	</div>
	<Button type="submit" size="sm" disabled={sending}>
		{#if sending}
			Sending…
		{:else}
			Email invoice
		{/if}
	</Button>
</form>
{#if emailedTo}
	<p class="note" role="status">Sent to {emailedTo}.</p>
{:else if sentTo && sentAt}
	<p class="note">Last sent to {sentTo} on {formatSentAt(sentAt)}.</p>
{/if}

<style>
	.email-form {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 8px;
	}

	.field {
		flex: 1 1 16rem;
		max-width: 24rem;
	}

	.note {
		margin: 0;
		font-size: 13px;
		color: var(--text-secondary);
	}
</style>
