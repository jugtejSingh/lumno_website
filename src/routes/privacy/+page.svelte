<script lang="ts">
	import Nav from '$lib/components/utils/Nav.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
</script>

<svelte:head>
	<title>Privacy Policy — Lumno</title>
	<meta name="description" content="How Lumno collects, uses, and protects your data." />
</svelte:head>

<div class="page">
	<Nav />
	<main class="legal">
		<h1 class="display">Privacy Policy</h1>
		<p class="updated">Last updated: September 6, 2026</p>

		<p>
			Lumno ("we", "us") provides practice-management software for therapists. This policy
			explains what we collect and how we use it. It covers the therapist accounts that sign up
			for Lumno and the clients they book through it.
		</p>

		<h2>What we collect</h2>
		<p>
			Account details (name, email) for therapists who sign up. Appointment, client, and note
			data that a therapist enters or that their clients submit through booking. Payment
			metadata from our payment processor — we do not store card numbers ourselves. If a
			therapist connects Google Calendar, we access only calendar events needed to create and
			manage appointments and Meet links.
		</p>

		<h2>How we use it</h2>
		<p>
			To run the core features of the product: scheduling, reminders, payments, and notes. To
			send transactional emails (booking confirmations, reminders). We do not sell client or
			therapist data, and we do not use client notes for any purpose beyond displaying them back
			to the therapist who wrote them. We do not run analytics, tracking, or advertising, and we
			collect no data beyond what is needed to provide the service.
		</p>

		<h2>AI features</h2>
		<p>
			Some features (such as note cleanup and formatting) are performed by third-party AI
			providers. These providers process the text only to return a result and do not store the
			prompts or use them for training. We do not retain any additional consumer information as a
			result of these features — the output is stored the same way as any other note, visible
			only to the therapist who owns it.
		</p>

		<h2>Who can see it</h2>
		<p>
			Client notes and appointment details are visible only to the therapist who owns that
			account. We do not access this data except as needed to provide support or maintain the
			service. All stored data is held securely and only for the account owner to view — no one
			else.
		</p>

		<h2>Data retention & deletion</h2>
		<p>
			Data is kept for as long as the account is active. Therapists can request deletion of their
			account and associated data by contacting us.
		</p>

		<h2>Contact</h2>
		<p>Questions about this policy can be sent to the address listed on our contact page.</p>
	</main>
	<Footer />
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--surface-app);
		color: var(--text-primary);
	}

	.legal {
		max-width: 720px;
		margin: 0 auto;
		padding: 64px 48px 96px;
	}

	.display {
		font-family: var(--font-display);
		font-size: 40px;
		margin: 0;
	}

	.updated {
		color: var(--text-muted);
		font-size: 13px;
		margin: 10px 0 40px;
	}

	h2 {
		font-size: 20px;
		margin: 32px 0 10px;
	}

	p {
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin: 0 0 4px;
	}
</style>
