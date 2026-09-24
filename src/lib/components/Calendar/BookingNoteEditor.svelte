<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$lib/enhance';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Button from '$lib/components/utils/Button.svelte';

	let {
		saved,
		message
	}: {
		// the note as currently stored; changes after a successful save reloads the page data
		saved: string;
		message?: string;
	} = $props();

	// form draft: deliberately seeded from the initial prop value only
	let text = $state(untrack(() => saved));
	const changed = $derived(text.trim() !== saved.trim());
</script>

<form class="note-editor" method="POST" action="?/saveBookingNote" use:enhance>
	<Textarea
		label="Note for your clients"
		info="Shown to clients above the booking calendar in their portal, e.g. that payment is due before the session starts."
		name="bookingNote"
		placeholder="e.g. Payment must be made before the session starts."
		rows={3}
		bind:value={text}
	/>
	{#if message}
		<div class="form-error">{message}</div>
	{/if}
	{#if changed}
		<div class="note-actions">
			<Button type="submit" variant="primary" size="sm">Save note</Button>
		</div>
	{/if}
</form>

<style>
	.note-editor {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.note-actions {
		display: flex;
		justify-content: flex-end;
	}

	.form-error {
		font-size: 13px;
		color: var(--danger, #b3261e);
	}
</style>
