<script lang="ts">
	import Nav from '$lib/components/utils/Nav.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
</script>

<svelte:head>
	<title>Terms of Service — Lumno</title>
</svelte:head>

<div class="page">
	<Nav />
	<main class="legal">
		<h1 class="display">Terms of Service</h1>
		<p class="updated">Last updated: September 2, 2026</p>

		<p>
			These terms govern use of Lumno, practice-management software for therapists. By creating
			an account you agree to them.
		</p>

		<h2>The service</h2>
		<p>
			Lumno provides scheduling, payments, reminders, and note-taking tools for solo therapy
			practices. We may change or discontinue features and will do our best to give notice of
			material changes.
		</p>

		<h2>Your account</h2>
		<p>
			You're responsible for the accuracy of the information you enter and for keeping your
			login credentials secure. You're responsible for the content of client notes and for
			complying with any professional or legal obligations around client record-keeping in your
			jurisdiction.
		</p>

		<h2>Payments</h2>
		<p>
			Paid plans are billed on a recurring basis through our payment processor until cancelled.
			Fees are non-refundable except where required by law.
		</p>

		<h2>Acceptable use</h2>
		<p>
			Don't use Lumno to store or transmit unlawful content, or to attempt to disrupt or gain
			unauthorized access to the service.
		</p>

		<h2>Disclaimer & liability</h2>
		<p>
			Lumno is provided "as is" without warranties of any kind. Lumno is not a substitute for
			clinical judgment, licensing compliance, or professional record-keeping requirements — you
			remain responsible for those. To the extent permitted by law, our liability is limited to
			the amount you paid us in the twelve months before a claim.
		</p>

		<h2>Contact</h2>
		<p>Questions about these terms can be sent to the address listed on our contact page.</p>
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
