<script lang="ts">
	import Card from '$lib/components/utils/Card.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import Dialog from '$lib/components/utils/Dialog.svelte';
	import { enhance } from '$lib/enhance';
	import { toast } from 'svelte-sonner';

	let { connected }: { connected: boolean } = $props();

	let confirmOpen = $state(false);
</script>

<Card>
	<div class="section">
		<div class="section-title">Google Calendar</div>
		{#if connected}
			<div class="helper">
				Connected. Online sessions get a Google Meet link automatically. This Google account can
				also be used to sign in.
			</div>
			<Button variant="secondary" size="sm" onclick={() => (confirmOpen = true)}>Disconnect</Button>
		{:else}
			<div class="helper">Connect to add a Meet link to online sessions automatically.</div>
			<form method="POST" action="?/connectGoogleCalendar">
				<Button type="submit" variant="secondary" size="sm">Connect Google Calendar</Button>
			</form>
		{/if}
	</div>
</Card>

<Dialog open={confirmOpen} title="Disconnect Google?" onclose={() => (confirmOpen = false)}>
	<p class="helper">
		New online sessions will stop getting Meet links, and you won't be able to sign in with this
		Google account. Sessions already booked keep their links.
	</p>
	<form
		class="confirm-actions"
		method="POST"
		action="?/disconnectGoogleCalendar"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'failure') {
					toast.error(String(result.data?.message ?? 'Could not disconnect Google'));
				} else if (result.type === 'success') {
					toast.success('Google disconnected');
					confirmOpen = false;
				}
				await update();
			};
		}}
	>
		<Button type="button" variant="secondary" size="sm" onclick={() => (confirmOpen = false)}>
			Cancel
		</Button>
		<Button type="submit" variant="primary" size="sm">Disconnect</Button>
	</form>
</Dialog>

<style>
	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}

	.section-title {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.helper {
		font-size: 13px;
		color: var(--text-muted);
	}

	.confirm-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 16px;
	}
</style>
