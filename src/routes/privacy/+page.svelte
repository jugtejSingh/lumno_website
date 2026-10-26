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
		<p class="updated">Last updated: October 26, 2026</p>

		<p>
			Lumno ("we", "us") is practice-management software for therapists and other practitioners.
			This policy explains what information we collect, why we collect it, who we share it with, and
			how we keep it safe. It covers both the practitioners who sign up for Lumno and the clients
			they book through it.
		</p>

		<div class="emphasis">
			<p>
				<strong>The short version:</strong> your information is stored in a secure database, encrypted
				whenever it is sent, received, or stored, and treated as confidential. We never sell it, never
				use it for advertising, and never use it to train AI.
			</p>
		</div>

		<h2>What we collect</h2>
		<ul>
			<li>
				<strong>Practitioner accounts:</strong> name, email address, and the settings needed to run
				the account.
			</li>
			<li>
				<strong>Client details:</strong> the name, email address, phone number, and time zone a
				practitioner enters or a client provides when booking.
			</li>
			<li>
				<strong>Appointments and notes:</strong> session times, and the notes a practitioner writes
				about their sessions.
			</li>
			<li>
				<strong>Payment details:</strong> records of payments from our payment processor, such as the
				amount and status. We never see or store card numbers.
			</li>
			<li>
				<strong>Google Calendar (optional):</strong> if a practitioner connects it, only the calendar
				events needed to create and manage their appointments and Meet links.
			</li>
		</ul>

		<h2>How we use it</h2>
		<p>
			We use this information only to run Lumno: scheduling, payments, notes, and sending booking
			confirmations and reminders by email and WhatsApp. Session notes are only ever shown to the
			practitioner who wrote them, are used by the optional AI features described below when that
			practitioner asks, and are shared with a client only when the practitioner chooses to share a
			note with them.
		</p>
		<p>
			We do not sell data, show ads, or run analytics that track people across the web. We collect
			only what we need to provide the service.
		</p>

		<h2>Google user data</h2>
		<p>
			Connecting Google Calendar is optional. When a practitioner connects it, we request only the
			<code>calendar.events</code> permission. We use it to create, update, and delete the calendar
			events and Google Meet links for that practitioner's own appointments, and for nothing else.
			We do not read their other events, contacts, email, or any other Google data. We store the
			access tokens needed to do this on the practitioner's behalf. The practitioner can revoke
			access at any time from Settings or from their Google account's permissions page, and we
			delete the tokens when they do.
		</p>
		<p>
			Google user data is never sold, never used for advertising, never shared with anyone except as
			listed under "Who we share data with" below, and never used to create, train, or improve any
			machine learning or artificial intelligence model. Lumno's use of information received from
			Google APIs adheres to the
			<a href="https://developers.google.com/terms/api-services-user-data-policy">
				Google API Services User Data Policy</a
			>, including the Limited Use requirements.
		</p>

		<h2>How we use AI</h2>
		<p>
			Practitioners on paid plans can use optional AI features to tidy up the wording of a session
			note, write a short summary of it, draft a client-friendly recap, or ask questions about a
			client's notes. The AI runs only when a practitioner chooses to use one of these features,
			never automatically in the background. Every AI request follows these rules:
		</p>
		<ul>
			<li>
				<strong>Only what's needed is sent:</strong> just the note text that task requires, and nothing
				else from the account.
			</li>
			<li>
				<strong>Nothing is kept:</strong> requests go through OpenRouter only to AI providers with a
				zero-data-retention policy. They process the request, send back the answer, and keep no copy
				of either.
			</li>
			<li>
				<strong>Never used for training:</strong> neither those providers nor Lumno use your data to
				train or improve AI models.
			</li>
			<li>
				<strong>The practitioner stays in control:</strong> AI output is only a suggestion. Nothing is
				saved to a note or shared with a client until the practitioner reviews it and decides to. We
				do not save conversations with the AI assistant either; refreshing the page clears them.
			</li>
		</ul>
		<p>
			Put simply, it is like handing a page to a trusted assistant who reads it, gives you their
			suggestions, and hands it straight back without making a copy or remembering what was on it.
		</p>

		<h2>Who we share data with</h2>
		<p>
			We do not sell, rent, or trade any data. We share data only with the service providers below,
			each only for the purpose stated and only the data that purpose needs:
		</p>
		<ul>
			<li>
				<strong>Vercel</strong> hosts the application, so data passes through their servers while the
				app runs.
			</li>
			<li>
				<strong>Supabase</strong> hosts our database, where account, client, appointment, note, and
				connection data is stored.
			</li>
			<li>
				<strong>Google</strong>, only when a practitioner connects Google Calendar, receives that
				practitioner's appointment times and attendee details to create calendar events and Meet
				links.
			</li>
			<li>
				<strong>Razorpay</strong> processes payments and receives the details needed to take and pay
				out payments.
			</li>
			<li>
				<strong>Resend</strong> sends our emails, such as booking confirmations and reminders, and
				receives the recipient's email address and the message.
			</li>
			<li>
				<strong>Meta (WhatsApp)</strong> sends WhatsApp verification codes and appointment reminders,
				and receives the recipient's phone number and the message.
			</li>
			<li>
				<strong>OpenRouter</strong> and the AI providers it connects us to, only when a practitioner
				uses an AI feature, receive the note text for that request under the zero-data-retention rules
				above.
			</li>
			<li>
				<strong>Sentry</strong> receives error reports when something in the app breaks, so we can fix
				it. If an error happens on screen, Sentry may record what led up to it, but all text is hidden
				and all images are blocked before anything leaves the browser.
			</li>
		</ul>
		<p>
			We may also disclose data when required by law, or to protect the rights and safety of our
			users. Otherwise, we do not share any data with anyone.
		</p>

		<h2>How we protect your data</h2>
		<p>
			All practitioner and client information, including session notes, is stored in a secure
			database and handled confidentially using industry-standard security practices. In everyday
			terms:
		</p>
		<ul>
			<li>
				<strong>Encrypted while travelling:</strong> everything sent between your device and Lumno, and
				between Lumno and the services we use, is encrypted with HTTPS/TLS. It is like posting a letter
				in a sealed, tamper-proof envelope: anyone who intercepts it sees only scrambled text.
			</li>
			<li>
				<strong>Encrypted while stored:</strong> our database host encrypts all data on its disks. It
				is like keeping files in a locked safe: even someone who took the hard drive could not read
				them.
			</li>
			<li>
				<strong>Passwords are never stored:</strong> we keep only a scrambled, one-way fingerprint of
				each password. We can check a password is correct, but no one, including us, can turn the
				fingerprint back into the password.
			</li>
			<li>
				<strong>Connection keys stay locked away:</strong> the keys that link a practitioner's Google
				Calendar or Razorpay account are kept only on our servers, are never sent to the browser, and
				are deleted when the account is disconnected. Razorpay keys are also encrypted a second time
				with AES-256, like a safe inside a safe.
			</li>
			<li>
				<strong>Practitioners see only their own clients:</strong> every request is checked so that a
				practitioner can reach only their own clients, notes, and appointments, and a client can see
				only what their practitioner has shared with them. The database can be reached only from our
				servers, never directly from a browser.
			</li>
			<li>
				<strong>Strictly limited access:</strong> only the people who run Lumno can access our
				production systems, and that access is protected by authentication and access controls. We do
				not look at your data except when needed to provide support or keep the service running.
			</li>
		</ul>

		<h2>Data retention & deletion</h2>
		<p>
			We keep data for as long as the account is active. Practitioners can ask us to delete their
			account and its data at any time by emailing
			<a href="mailto:support@lumno.in">support@lumno.in</a>.
		</p>

		<h2>Contact</h2>
		<p>
			Questions about this policy or your data? Contact us at
			<a href="mailto:support@lumno.in">support@lumno.in</a>.
		</p>
	</main>
	<Footer />
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--wallpaper) var(--surface-app);
		color: var(--text-primary);
	}

	.legal {
		max-width: 720px;
		margin: 0 auto;
		padding: clamp(40px, 8vw, 64px) clamp(16px, 5vw, 48px) 96px;
	}

	.display {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(28px, 7vw, 40px);
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

	.emphasis {
		border-left: 3px solid var(--text-primary);
		padding: 4px 0 4px 16px;
		margin: 24px 0 8px;
	}

	.emphasis p {
		color: var(--text-primary);
	}
</style>
