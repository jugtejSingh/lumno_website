<script lang="ts">
	import { onMount } from 'svelte';

	// Google Ads tag. Only placed on public marketing pages; never on (app)/(portal).
	const GOOGLE_ADS_ID = 'AW-18542650696';

	// Injected on mount instead of via <svelte:head>: inline scripts added there
	// don't execute after a client-side navigation.
	// ponytail: loads once per tab; no extra page_view on client-side navigation
	// between public pages. Add a page.url effect if Ads reporting needs it.
	onMount(() => {
		if (window.gtag) {
			return;
		}

		window.dataLayer = window.dataLayer || [];
		window.gtag = function gtag() {
			// gtag.js expects the raw arguments object, not an array.
			window.dataLayer.push(arguments);
		};
		window.gtag('js', new Date());
		window.gtag('config', GOOGLE_ADS_ID);

		const script = document.createElement('script');
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
		document.head.appendChild(script);
	});
</script>
