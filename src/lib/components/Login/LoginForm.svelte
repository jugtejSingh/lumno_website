<script lang="ts">
	import type { Snippet } from 'svelte';
	import Input from '$lib/components/utils/Input.svelte';
	import Button from '$lib/components/utils/Button.svelte';
	import { enhance } from '$lib/enhance';

	// Email sign-in. Which role it signs in as is decided by the page's
	// signInEmail action, not by anything in this form.
	let {
		message,
		emailPlaceholder,
		footer
	}: {
		message?: string;
		emailPlaceholder: string;
		footer: Snippet;
	} = $props();
</script>

<form class="form-block" method="POST" action="?/signInEmail" use:enhance>
	<div class="form-fields">
		<Input label="Email" name="email" placeholder={emailPlaceholder} type="email" />
		<Input label="Password" name="password" placeholder="••••••••" type="password" />
		{#if message}
			<div class="form-error">{message}</div>
		{/if}
		<div class="forgot"><a href="/login">Forgot password?</a></div>
		<Button type="submit" variant="primary">Log in</Button>
	</div>
	<div class="switch-line">
		{@render footer()}
	</div>
</form>

<style>
	.form-block {
		margin-top: 24px;
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
</style>
