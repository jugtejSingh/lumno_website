<script lang="ts">
	import Logo from '$lib/components/utils/Logo.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Accept invite — Lumno</title>
</svelte:head>

<div class="page">
	<div class="header">
		<Logo />
	</div>

	<div class="center">
		<div class="auth-card">
			{#if !data.invite}
				<div class="form-title">Invite not found</div>
				<div class="form-subtitle">
					This invite link is invalid, expired, or has already been used. Ask your therapist to
					send a new one.
				</div>
			{:else if data.loggedInAsOther}
				<div class="form-title">Wrong account</div>
				<div class="form-subtitle">
					You're logged in with a different email than this invite ({data.invite.email}).
				</div>
				<form method="POST" action="/logout">
					<Button type="submit" variant="secondary">Log out</Button>
				</form>
			{:else if data.loggedInAsMatch}
				<div class="form-title">Join {data.invite.name}'s care team</div>
				<div class="form-subtitle">Accept as {data.invite.email}?</div>
				{#if form?.message}
					<div class="form-error">{form.message}</div>
				{/if}
				<form method="POST" action="?/acceptAsSelf" use:enhance>
					<Button type="submit" variant="primary">Accept invite</Button>
				</form>
			{:else}
				<div class="form-title">You've been invited</div>
				<div class="form-subtitle">
					{data.hasAccount
						? `Log in as ${data.invite.email} to accept.`
						: `Set a password for ${data.invite.email} to get started.`}
				</div>

				<form method="POST" action="?/google" use:enhance>
					<Button type="submit" variant="secondary">Continue with Google</Button>
				</form>
				<div class="divider"><span>or</span></div>

				<form class="form-fields" method="POST" action="?/password" use:enhance>
					<Input label="Password" name="password" type="password" placeholder="••••••••" />
					{#if form?.message}
						<div class="form-error">{form.message}</div>
					{/if}
					<Button type="submit" variant="primary">
						{data.hasAccount ? 'Log in and accept' : 'Create account'}
					</Button>
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

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 16px;
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 16px 0;
		font-size: 12px;
		color: var(--text-muted);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-subtle);
	}
</style>