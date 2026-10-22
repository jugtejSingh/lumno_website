<script lang="ts">
	import Logo from '$lib/components/utils/Logo.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import ClientProfileFields from '$lib/components/Clients/ClientProfileFields.svelte';
	import ClientProfileHiddenInputs from '$lib/components/Clients/ClientProfileHiddenInputs.svelte';
	import PhoneVerification from '$lib/components/Clients/PhoneVerification.svelte';
	import PhoneInput from '$lib/components/utils/PhoneInput.svelte';
	import type { ClientProfile } from '$lib/clientProfile';
	import { enhance } from '$lib/enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// optional; saved as pending, and used for WhatsApp reminders once verified.
	// Shared by the Google and password forms below via hidden inputs.
	let phone = $state('');
	// required; mirrored into whichever form gets submitted
	let profile = $state<ClientProfile>({
		dateOfBirth: '',
		gender: '',
		city: '',
		state: '',
		country: ''
	});

	const PROFILE_FIELDS: (keyof ClientProfile)[] = ['dateOfBirth', 'gender', 'city', 'state', 'country'];

	// The actions tag each failure with the `field` it belongs to (a profile key,
	// 'phone', 'password' or 'google'), so it shows next to that input. Untagged ones
	// (e.g. invite no longer valid) show at the top of the card.
	const failedField = $derived.by(() => {
		if (form && 'field' in form && typeof form.field === 'string') {
			return form.field;
		}
		return null;
	});

	const failedMessage = $derived.by(() => {
		if (form && 'message' in form && typeof form.message === 'string') {
			return form.message;
		}
		return '';
	});

	// Typing in the phone or password box hides its error; a new response (a new
	// `form` object) clears this so a failed resubmit shows the error again.
	// The profile fields do the same inside ClientProfileFields.
	let editedFields = $state<string[]>([]);
	$effect.pre(() => {
		void form;
		editedFields = [];
	});

	function markEdited(field: string) {
		if (!editedFields.includes(field)) {
			editedFields.push(field);
		}
	}

	function errorFor(field: string): string | undefined {
		if (failedMessage && failedField === field && !editedFields.includes(field)) {
			return failedMessage;
		}
		return undefined;
	}

	const profileError = $derived.by(() => {
		for (const field of PROFILE_FIELDS) {
			if (failedMessage && failedField === field) {
				return { field, message: failedMessage };
			}
		}
		return null;
	});

	const generalError = $derived.by(() => {
		if (failedMessage && !failedField) {
			return failedMessage;
		}
		return '';
	});
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
				<div class="form-title">{data.invalid?.title ?? 'Invite not found'}</div>
				<div class="form-subtitle">{data.invalid?.body ?? ''}</div>
				{#if data.invalid?.title === 'Invite already used'}
					<Button href="/login/client" variant="primary">Log in</Button>
				{/if}
			{:else if data.loggedInAsOther}
				<div class="form-title">Wrong account</div>
				<div class="form-subtitle">
					You're logged in with a different email than this invite ({data.invite.email}).
				</div>
				{#if data.oauthError}
					<div class="form-error">{data.oauthError}</div>
				{/if}
				<form method="POST" action="/logout?to=client">
					<Button type="submit" variant="secondary">Log out</Button>
				</form>
			{:else if data.loggedInAsMatch}
				<div class="form-title">Join {data.invite.therapistName}'s client portal</div>
				<div class="form-subtitle">Accept as {data.invite.email}?</div>
				{#if generalError}
					<div class="form-error" role="alert">{generalError}</div>
				{/if}
				<form class="form-fields" method="POST" action="?/acceptAsSelf" use:enhance>
					{#if data.needsProfile}
						<div class="form-hint-block">Your practitioner will see these details.</div>
						<ClientProfileFields bind:profile error={profileError} />
					{/if}
					<Button type="submit" variant="primary">Accept invite</Button>
				</form>
			{:else}
				<div class="form-title">You've been invited</div>
				<div class="form-subtitle">
					{data.hasAccount
						? `Log in as ${data.invite.email} to accept.`
						: `Set a password for ${data.invite.email} to get started.`}
				</div>
				{#if data.oauthError}
					<div class="form-error" role="alert">{data.oauthError}</div>
				{/if}
				{#if generalError}
					<div class="form-error" role="alert">{generalError}</div>
				{/if}

				<div class="form-fields">
					<div class="form-hint-block">About you — your practitioner will see these details.</div>
					<ClientProfileFields bind:profile named={false} error={profileError} />
					<PhoneInput
						label="Phone (optional)"
						hint="Your number is only used to send session reminders on WhatsApp. It is optional and can be skipped. WhatsApp numbers only, other numbers will not work."
						error={errorFor('phone')}
						oninput={() => markEdited('phone')}
						bind:value={phone}
					/>
					{#if phone}
						<!-- optional: skipping it leaves the number pending and reminders on email -->
						{#key phone}
							<PhoneVerification {phone} />
						{/key}
					{/if}
				</div>

				<form class="google-form" method="POST" action="?/google" use:enhance>
					<input type="hidden" name="phone" value={phone} />
					<ClientProfileHiddenInputs {profile} />
					<div class="form-hint-block">
						Either continue with Google for passwordless login, or write in a password below.
					</div>
					<Button type="submit" variant="secondary">Continue with Google</Button>
					{#if errorFor('google')}
						<div class="form-error" role="alert">{errorFor('google')}</div>
					{/if}
				</form>
				<div class="divider"><span>or</span></div>

				<form class="form-fields" method="POST" action="?/password" use:enhance>
					<input type="hidden" name="phone" value={phone} />
					<ClientProfileHiddenInputs {profile} />
					<Input
						label="Password"
						name="password"
						type="password"
						placeholder="••••••••"
						error={errorFor('password')}
						oninput={() => markEdited('password')}
					/>
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
		background: var(--wallpaper) var(--surface-app);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px clamp(20px, 5vw, 48px);
		border-bottom: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
	}

	.center {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(20px, 6vw, 40px);
	}

	.auth-card {
		width: min(380px, 100%);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-top-width: 14px;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: clamp(24px, 5vw, 36px);
	}

	.form-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(24px, 5vw, 30px);
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
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-danger, #c0392b);
	}

	.google-form {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		margin-top: 24px;
		text-align: center;
	}

	.form-hint-block {
		font-size: 13px;
		color: var(--text-muted);
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
