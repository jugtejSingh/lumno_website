<script lang="ts">
	import LoginLayout from '$lib/components/Login/LoginLayout.svelte';
	import Banner from '$lib/components/Login/Banner.svelte';
	import GoogleSignIn from '$lib/components/Login/GoogleSignIn.svelte';
	import LoginForm from '$lib/components/Login/LoginForm.svelte';
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const accountRemoved = $derived(page.url.searchParams.get('error') === 'account_removed');
</script>

<svelte:head>
	<title>Client log in — Lumno</title>
</svelte:head>

<LoginLayout title="Welcome back" subtitle="Log in to view your sessions, payments, and notes" short>
	{#snippet banners()}
		{#if data.oauthError}
			<Banner bad>{data.oauthError}</Banner>
		{/if}
		{#if accountRemoved}
			<Banner bad>
				Your account is no longer linked to a profile — please log in again or contact your
				practitioner.
			</Banner>
		{/if}
	{/snippet}

	<GoogleSignIn />

	<LoginForm message={form?.message} emailPlaceholder="you@example.com">
		{#snippet footer()}
			If your account doesn't exist, ask your practitioner to send you an invite.
			<div class="other-role">Practitioner? <a href="/login">Log in here</a></div>
		{/snippet}
	</LoginForm>
</LoginLayout>

<style>
	.other-role {
		margin-top: 10px;
	}

	.other-role a {
		color: var(--text-link);
		font-weight: 700;
	}
</style>
