<script lang="ts">
	import Logo from '$lib/components/utils/Logo.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Become a therapist — Lumno</title>
</svelte:head>

<div class="page">
	<div class="header">
		<Logo />
	</div>

	<div class="center">
		<div class="auth-card">
			{#if !data.valid}
				<div class="form-title">Link expired</div>
				<div class="form-subtitle">
					This link is invalid or has already been used. Try registering again.
				</div>
			{:else}
				<div class="form-title">Add a therapist profile</div>
				<div class="form-subtitle">
					This confirms you own this email. Confirm to add a therapist practice to your account —
					you can fill in your bio, photo, and specialties afterward in settings.
				</div>
				{#if form?.message}
					<div class="form-error">{form.message}</div>
				{/if}
				<form method="POST" use:enhance>
					<Button type="submit" variant="primary">Confirm</Button>
				</form>
			{/if}
		</div>
	</div>

	<Footer />
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--surface-app);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 48px;
		border-bottom: 1px solid var(--border-subtle);
	}

	.center {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px;
	}

	.auth-card {
		width: 380px;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: 36px;
	}

	.form-title {
		font-family: var(--font-display);
		font-size: 30px;
		color: var(--text-primary);
	}

	.form-subtitle {
		font-size: 14px;
		color: var(--text-muted);
		margin-top: 4px;
		margin-bottom: 24px;
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
		margin-bottom: 12px;
	}
</style>