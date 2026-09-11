<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/utils/Logo.svelte';
	import Button from '$lib/components/utils/Button.svelte';

	// page.error.message is whatever handleError in hooks.server.ts chose to
	// expose — a generic line plus a short reference id, never internals.
	const title = $derived(page.status === 404 ? 'Page not found' : 'Something went wrong');
</script>

<svelte:head>
	<title>{title} — Lumno</title>
</svelte:head>

<div class="page">
	<div class="header">
		<Logo />
	</div>

	<div class="center">
		<div class="card">
			<div class="code">{page.status}</div>
			<div class="title">{title}</div>
			<div class="subtitle">
				{#if page.status === 404}
					That page doesn't exist or has moved.
				{:else}
					{page.error?.message ?? 'Please try again in a moment.'}
				{/if}
			</div>
			<div class="actions">
				<Button variant="secondary" onclick={() => history.back()}>Go back</Button>
				<Button variant="primary" href="/">Home</Button>
			</div>
		</div>
	</div>
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
		padding: 20px clamp(20px, 5vw, 48px);
		border-bottom: 1px solid var(--border-subtle);
	}

	.center {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(20px, 6vw, 40px);
	}

	.card {
		width: min(420px, 100%);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: clamp(24px, 5vw, 36px);
		text-align: center;
	}

	.code {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-muted);
	}

	.title {
		font-family: var(--font-display);
		font-size: clamp(24px, 5vw, 30px);
		color: var(--text-primary);
		margin-top: 4px;
	}

	.subtitle {
		font-size: 14px;
		color: var(--text-muted);
		margin-top: 8px;
		margin-bottom: 24px;
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: 10px;
	}
</style>
