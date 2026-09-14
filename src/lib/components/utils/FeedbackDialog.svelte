<script lang="ts">
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import Dialog from './Dialog.svelte';
	import Input from './Input.svelte';
	import Textarea from './Textarea.svelte';
	import Button from './Button.svelte';

	let { open, onclose }: { open: boolean; onclose: () => void } = $props();

	let email = $state('');
	let subject = $state('');
	let message = $state('');
	let errorMessage = $state('');
	let sending = $state(false);

	// Signed-in users send from their account email, so only visitors see the field.
	const signedIn = $derived(page.data.signedIn === true);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (sending) {
			return;
		}
		sending = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email, subject, message })
			});

			if (!response.ok) {
				let body: { message?: string } = {};
				try {
					body = await response.json();
				} catch {
					// non-JSON error page; fall back to the generic line below
				}
				if (body.message) {
					errorMessage = body.message;
				} else {
					errorMessage = 'Could not send your feedback. Please try again.';
				}
				return;
			}

			toast.success('Thanks — your message is on its way to us.');
			email = '';
			subject = '';
			message = '';
			onclose();
		} catch {
			errorMessage = 'Could not send your feedback. Please try again.';
		} finally {
			sending = false;
		}
	}
</script>

<Dialog {open} title="Feedback & issues" {onclose}>
	<form class="feedback-form" onsubmit={submit}>
		{#if !signedIn}
			<Input label="Your email" type="email" name="email" bind:value={email} />
		{/if}
		<Input label="Subject" name="subject" bind:value={subject} />
		<Textarea label="Message" name="message" rows={5} bind:value={message} />
		{#if errorMessage}
			<div class="form-error">{errorMessage}</div>
		{/if}
		<Button type="submit" variant="primary">
			{#if sending}
				Sending…
			{:else}
				Send
			{/if}
		</Button>
	</form>
</Dialog>

<style>
	.feedback-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: min(360px, calc(100vw - 80px));
	}

	.form-error {
		font-size: 13px;
		color: var(--danger, #b3261e);
	}
</style>
