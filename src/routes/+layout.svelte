<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
</script>

<Toaster richColors position="top-center" />

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
