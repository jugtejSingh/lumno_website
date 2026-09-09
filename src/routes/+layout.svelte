<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';
	import { navigating } from '$app/state';

	let { children } = $props();
</script>

<Toaster richColors position="top-center" />

{#if navigating.to}
	<div class="nav-progress" role="progressbar" aria-label="Loading page"></div>
{/if}

<svelte:head>
	<title>Lumno — Practice management for therapists</title>
	<meta
		name="description"
		content="Scheduling, reminders, payments, and notes — one calm place to run the parts of your practice that aren't the session itself."
	/>

	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />
	<meta name="theme-color" content="#e7dac4" />
</svelte:head>

{@render children()}

<style>
	.nav-progress {
		position: fixed;
		top: 0;
		left: 0;
		height: 3px;
		width: 100%;
		z-index: 9999;
		background: var(--accent-primary);
		transform-origin: left;
		animation: nav-progress 1.2s ease-out forwards;
	}

	/* ponytail: fake progress; it stalls at 90% until the navigation resolves */
	@keyframes nav-progress {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(0.9);
		}
	}
</style>
