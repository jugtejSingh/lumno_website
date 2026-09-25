<script lang="ts">
	import { goto } from '$app/navigation';
	import Dialog from './Dialog.svelte';
	import Button from './Button.svelte';

	let { open }: { open: boolean } = $props();

	// closes instantly without waiting for the layout data to reload
	let dismissed = $state(false);

	function dismiss() {
		dismissed = true;
		// ponytail: fire-and-forget; if it fails the modal just shows again next visit
		fetch('/welcome', { method: 'POST' });
	}

	function openGuide() {
		dismiss();
		goto('/guide');
	}
</script>

<Dialog open={open && !dismissed} title="Welcome to your space" onclose={dismiss}>
	<div class="welcome">
		<p>
			Our idea is simple: to provide therapists with a space where they can manage everything
			related to their practice, all in one place. Our goal is to keep improving, giving you the
			flexibility you want.
		</p>
		<p>
			Please go through the guide to set this space up exactly how you want it, so you feel at
			ease. Feel free to use the Feedback button to send us feedback or raise any issues you
			face. We do our best to resolve issues within the same day and to implement necessary
			feedback within a week.
		</p>
		<p>We have just launched, and we hope our website becomes the home of your practice.</p>
		<div class="welcome-actions">
			<Button variant="secondary" onclick={dismiss}>Maybe later</Button>
			<Button variant="primary" onclick={openGuide}>Open the guide</Button>
		</div>
	</div>
</Dialog>

<style>
	.welcome p {
		margin: 0 0 12px;
		line-height: 1.55;
		color: var(--text-primary);
	}

	.welcome-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 18px;
	}
</style>
