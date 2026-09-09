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
		<p class="updated">Last updated: September 9, 2026</p>

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

		<h2>Google user data</h2>
		<p>
			Connecting Google Calendar is optional. When a therapist connects it, we request the
			<code>calendar.events</code> scope only. We use it to create, update, and delete the
			calendar events and Google Meet links for that therapist's own appointments, and for nothing
			else. We do not read other events, contacts, email, or any other Google data. We store the
			OAuth tokens needed to do this on the therapist's behalf; the therapist can revoke access at
			any time from Settings or from their Google account permissions page, and we delete the tokens
			when they do.
		</p>
		<p>
			Google user data is never sold, never used for advertising, never shared with any third
			party except as listed under "Who we share data with" below, and never used to create,
			train, or improve any machine learning or artificial intelligence model. Lumno's use of
			information received from Google APIs adheres to the
			<a href="https://developers.google.com/terms/api-services-user-data-policy">
				Google API Services User Data Policy</a
			>, including the Limited Use requirements.
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
			Note cleanup and formatting is performed by the DeepSeek V4 Flash 0731 model, accessed via
			API and served by the third-party inference providers Wafer, Makora, and Reka AI. Only the
			note text the therapist explicitly asks to clean up is sent. Each of these providers
			operates under terms that prohibit storing our inputs or outputs and prohibit using them to
			train models, so the text is processed to return a result and then discarded.
		</p>
		<p>
			This is the only thing we use AI for: cleaning up session notes a therapist has written
			about their own client. AI is not used for any other feature. In particular, no Google
			user data is ever sent to any AI provider. We do not use Google Workspace, Photos, or any
			other Google API data with AI in any way. Calendar events, Meet links, and OAuth tokens are
			used only to manage appointments, and no AI feature reads or receives them. The output of
			AI features is stored the same way as any other note, visible only to the therapist who
			owns it.
		</p>

		<h2>Who we share data with</h2>
		<p>
			We do not sell, rent, or trade any data. We share, transfer, or disclose data only with the
			service providers below, each only for the purpose stated and only the data that purpose
			needs:
		</p>
		<ul>
			<li>
				<strong>Vercel</strong> — hosts the application. Data passes through their servers
				while the app runs.
			</li>
			<li>
				<strong>Supabase</strong> — hosts our PostgreSQL database, where account, appointment,
				client, note, and OAuth token data is stored.
			</li>
			<li>
				<strong>Google</strong> — only when a therapist connects Google Calendar, we send that
				therapist's appointment times and attendee details to Google to create calendar events
				and Meet links.
			</li>
			<li>
				<strong>Razorpay</strong> — processes payments. They receive the details needed to
				charge and pay out; we never see or store card numbers.
			</li>
			<li>
				<strong>Resend</strong> — sends transactional email such as booking confirmations and
				reminders. They receive recipient email addresses and the message content.
			</li>
			<li>
				<strong>Wafer, Makora, and Reka AI</strong> — inference providers for the AI note
				cleanup feature. They receive only the note text a therapist explicitly asks to clean
				up, do not store it, and never receive Google user data.
			</li>
		</ul>
		<p>
			We may also disclose data if required by law, or to protect the rights and safety of our
			users. Beyond this, Google user data and all other data is not shared with anyone.
		</p>

		<h2>How we protect it</h2>
		<p>
			All data is encrypted in transit using HTTPS/TLS, and encrypted at rest by our database
			host. Google OAuth tokens are stored server-side, are never exposed to the browser, and are
			deleted when the therapist disconnects Google Calendar. Access to production systems is
			limited to the people who operate Lumno and is protected by authentication and access
			controls. Client notes and appointment details are visible only to the therapist who owns
			that account; we do not access this data except as needed to provide support or maintain
			the service. We never share, transfer, or disclose sensitive data for advertising,
			profiling, or model training.
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

	p,
	li {
		color: var(--text-secondary);
		line-height: var(--lh-relaxed);
		margin: 0 0 4px;
	}

	ul {
		padding-left: 22px;
		margin: 8px 0;
	}

	a {
		color: inherit;
	}
</style>
