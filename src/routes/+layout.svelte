<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';
	import { navigating, page } from '$app/state';

	let { children } = $props();

	// Scrapers want absolute URLs for the preview card, so these are built off the
	// request origin rather than hardcoded to one domain.
	const SITE_TITLE = 'Lumno — Why juggle five apps when one will do?';
	const SITE_DESCRIPTION =
		'Lumno runs the admin side of a solo therapy practice: online booking on your real availability, automatic session and payment reminders, invoicing and card payments, session notes sent to clients, and a client portal — all in one place.';
	const ogImage = $derived(`${page.url.origin}/brand/og-image.png`);
</script>

<Toaster richColors position="top-center" />

{#if navigating.to}
	<div class="nav-progress" role="progressbar" aria-label="Loading page"></div>
{/if}

<svelte:head>
	<title>{SITE_TITLE}</title>
	<meta name="description" content={SITE_DESCRIPTION} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Lumno" />
	<meta property="og:title" content={SITE_TITLE} />
	<meta property="og:description" content={SITE_DESCRIPTION} />
	<meta property="og:url" content={page.url.href} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Lumno — why juggle five apps when one will do?" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={SITE_TITLE} />
	<meta name="twitter:description" content={SITE_DESCRIPTION} />
	<meta name="twitter:image" content={ogImage} />

	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />
	<meta name="theme-color" content="#fce7d5" />
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
