<script lang="ts">
	import Input from '$lib/components/utils/Input.svelte';
	import Textarea from '$lib/components/utils/Textarea.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import LoginLayout from '$lib/components/Login/LoginLayout.svelte';
	import Banner from '$lib/components/Login/Banner.svelte';
	import GoogleSignIn from '$lib/components/Login/GoogleSignIn.svelte';
	import LoginForm from '$lib/components/Login/LoginForm.svelte';
	import { page } from '$app/state';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function initialMode(): 'login' | 'register' {
		if (page.url.searchParams.get('tab') === 'register') {
			return 'register';
		}
		return 'login';
	}

	let mode = $state<'login' | 'register'>(initialMode());

	const headTitle = $derived.by(() => {
		if (mode === 'register') {
			return 'Create your account';
		}
		return 'Welcome back';
	});
	const headSubtitle = $derived.by(() => {
		if (mode === 'register') {
			return 'Set up your practice in about two minutes';
		}
		return 'Log in to your practice';
	});

	const checkEmail = $derived(page.url.searchParams.get('checkEmail') === '1');
	const therapistReady = $derived(page.url.searchParams.get('therapistReady') === '1');
	const emailFailed = $derived(page.url.searchParams.get('emailFailed') === '1');
	const accountRemoved = $derived(page.url.searchParams.get('error') === 'account_removed');
</script>

<svelte:head>
	<title>Practitioner log in — Lumno</title>
</svelte:head>

<LoginLayout title={headTitle} subtitle={headSubtitle} wide={mode === 'register'}>
	{#snippet banners()}
		{#if checkEmail && emailFailed}
			<Banner bad>
				Your account was created, but we couldn't send the verification email. Log in below to
				request a new one.
			</Banner>
		{:else if checkEmail}
			<Banner>Check your email to verify your account before logging in.</Banner>
		{/if}
		{#if data.oauthError}
			<Banner bad>{data.oauthError}</Banner>
		{/if}
		{#if accountRemoved}
			<Banner bad>
				Your account is no longer linked to a profile — please log in again or contact your
				practitioner.
			</Banner>
		{/if}
		{#if therapistReady}
			<Banner>Your practitioner profile is ready. Log in to get started.</Banner>
		{/if}
	{/snippet}

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

	<GoogleSignIn />

	{#if mode === 'login'}
		<LoginForm message={form?.message} emailPlaceholder="you@practice.com">
			{#snippet footer()}
				Don't have an account?
				<button type="button" class="link-btn" onclick={() => (mode = 'register')}>Register</button>
				<div class="other-role">Client? <a href="/login/client">Log in here</a></div>
			{/snippet}
		</LoginForm>
	{:else}
		<form class="form-block" method="POST" action="?/signUpEmail" use:enhance>
			<div class="form-fields">
				<div class="field-row">
					<Input label="Full name" name="name" placeholder="Dana Reyes" />
					<Input label="Email" name="email" placeholder="you@practice.com" type="email" />
				</div>
				<div class="field-row">
					<Input label="Password" name="password" placeholder="••••••••" type="password" />
					<Input label="Date of birth (optional)" name="dateOfBirth" type="date" />
				</div>
				<Textarea
					label="Bio (optional)"
					name="bio"
					placeholder="A few sentences for your booking page"
				/>
				<Input
					label="Specialties (optional, comma-separated)"
					name="tags"
					info="Shown on your community card so other practitioners know who to send your way. Add the services you offer (e.g. consultations, coaching, workshops), specialist areas (e.g. beginners, teams), the problems you help with and practical details (e.g. online, sliding scale). You can change these later in Settings."
					placeholder="Consultations, Coaching, Workshops, Online"
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
</LoginLayout>

<style>
	.mode-tabs {
		display: flex;
		gap: 16px;
		border-bottom: 2px dotted var(--beige-400);
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
		border-bottom-color: var(--coral-500);
	}

	.form-block {
		margin-top: 24px;
	}

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: end;
		gap: 14px;
	}

	@media (max-width: 480px) {
		.field-row {
			grid-template-columns: 1fr;
		}
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
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
		color: var(--text-link);
		font-weight: 700;
		cursor: pointer;
		font-size: 13px;
		font-family: var(--font-body);
		padding: 0;
	}

	.other-role {
		margin-top: 10px;
	}

	.other-role a {
		color: var(--text-link);
		font-weight: 700;
	}
</style>
