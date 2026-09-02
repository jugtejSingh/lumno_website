<script lang="ts">
	import Logo from '$lib/components/utils/Logo.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	type Role = 'Therapist' | 'Client';

	let role = $state<Role>('Therapist');
	let mode = $state<'login' | 'register'>(page.url.searchParams.get('tab') === 'register' ? 'register' : 'login');

	const isTherapist = $derived(role === 'Therapist');
	const loginSubtitle = $derived(
		isTherapist ? 'Log in to your practice' : 'Log in to view your sessions, payments, and notes'
	);

	function selectTherapist() {
		role = 'Therapist';
	}

	function selectClient() {
		role = 'Client';
		mode = 'login';
	}

	const checkEmail = $derived(page.url.searchParams.get('checkEmail') === '1');
	const therapistReady = $derived(page.url.searchParams.get('therapistReady') === '1');
</script>

<svelte:head>
	<title>Log in — Lumno</title>
</svelte:head>

<div class="page">
	<div class="header">
		<Logo />
	</div>

	<div class="center">
		<div class="auth-card">
			{#if checkEmail}
				<div class="banner">Check your email to verify your account before logging in.</div>
			{/if}
			{#if therapistReady}
				<div class="banner">Your therapist profile is ready. Log in to get started.</div>
			{/if}

			<div class="role-pill">
				<button type="button" class="pill-btn" class:active={isTherapist} onclick={selectTherapist}
					>Therapist</button
				>
				<button type="button" class="pill-btn" class:active={!isTherapist} onclick={selectClient}
					>Client</button
				>
			</div>

			{#if isTherapist}
				<div class="mode-tabs">
					<button type="button" class="tab" class:active={mode === 'login'} onclick={() => (mode = 'login')}
						>Log in</button
					>
					<button
						type="button"
						class="tab"
						class:active={mode === 'register'}
						onclick={() => (mode = 'register')}>Register</button
					>
				</div>
			{/if}

			{#if isTherapist}
				<form class="google-form" method="POST" action="?/signInGoogle" use:enhance>
					<Button type="submit" variant="secondary">Continue with Google</Button>
				</form>
				<div class="divider"><span>or</span></div>
			{/if}

			{#if mode === 'login'}
				<form class="form-block" method="POST" action="?/signInEmail" use:enhance>
					<div class="form-title">Welcome back</div>
					<div class="form-subtitle">{loginSubtitle}</div>
						<input type="hidden" name="role" value={role} />
					<div class="form-fields">
						<Input label="Email" name="email" placeholder="you@practice.com" type="email" />
						<Input label="Password" name="password" placeholder="••••••••" type="password" />
						{#if form?.message}
							<div class="form-error">{form.message}</div>
						{/if}
						<div class="forgot"><a href="/login">Forgot password?</a></div>
						<Button type="submit" variant="primary">Log in</Button>
					</div>
					{#if isTherapist}
						<div class="switch-line">
							Don't have an account?
							<button type="button" class="link-btn" onclick={() => (mode = 'register')}>Register</button>
						</div>
					{/if}
				</form>
			{:else}
				<form class="form-block" method="POST" action="?/signUpEmail" use:enhance>
					<div class="form-title">Create your account</div>
					<div class="form-subtitle">Set up your practice in about two minutes</div>
					<div class="form-fields">
						<Input label="Full name" name="name" placeholder="Dana Reyes" />
						<Input label="Practice name" name="practice" placeholder="Reyes Therapy" />
						<Input label="Email" name="email" placeholder="you@practice.com" type="email" />
						<Input label="Password" name="password" placeholder="••••••••" type="password" />
						<Input label="Profile picture URL (optional)" name="photoUrl" placeholder="https://..." />
						<Input label="Date of birth" name="dateOfBirth" type="date" />
						<Textarea
							label="Bio"
							name="bio"
							placeholder="A few sentences for your booking page"
						/>
						<Input
							label="Tags (comma-separated)"
							name="tags"
							placeholder="CBT, anxiety, sliding-scale"
						/>
						{#if form?.message}
							<div class="form-error">{form.message}</div>
						{/if}
						<Button type="submit" variant="primary">Create account</Button>
					</div>
					<div class="switch-line">
						Already have an account?
						<button type="button" class="link-btn" onclick={() => (mode = 'login')}>Log in</button>
					</div>
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

	.banner {
		margin-bottom: 16px;
		padding: 10px 14px;
		border-radius: var(--radius-md, 8px);
		font-size: 13px;
		font-weight: 600;
		background: var(--beige-200);
		color: var(--text-secondary);
	}

	.role-pill {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
		background: var(--beige-200);
		border-radius: var(--radius-pill);
		padding: 4px;
	}

	.pill-btn {
		flex: 1;
		padding: 8px 0;
		border: none;
		border-radius: var(--radius-pill);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		font-family: var(--font-body);
		background: transparent;
		color: var(--text-muted);
	}

	.pill-btn.active {
		background: var(--surface-card);
		color: var(--text-primary);
		box-shadow: var(--shadow-xs);
	}

	.google-form :global(.btn) {
		width: 100%;
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

	.mode-tabs {
		display: flex;
		gap: 16px;
		border-bottom: 1px solid var(--border-subtle);
	}

	.tab {
		border: none;
		background: transparent;
		padding: 8px 0;
		font-size: 14px;
		font-weight: 700;
		color: var(--text-muted);
		cursor: pointer;
		font-family: var(--font-body);
		border-bottom: 2px solid transparent;
	}

	.tab.active {
		color: var(--text-primary);
		border-bottom-color: var(--accent-primary);
	}

	.form-block {
		margin-top: 24px;
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
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
	}

	.forgot {
		text-align: right;
		font-size: 13px;
	}

	.forgot a {
		color: var(--text-muted);
		text-decoration: none;
	}

	.switch-line {
		margin-top: 20px;
		font-size: 13px;
		color: var(--text-secondary);
		text-align: center;
	}

	.link-btn {
		border: none;
		background: transparent;
		color: var(--accent-primary);
		font-weight: 700;
		cursor: pointer;
		font-size: 13px;
		font-family: var(--font-body);
		padding: 0;
	}
</style>