<script lang="ts">
	import GuideSection from './GuideSection.svelte';
	import GuideCallout from './GuideCallout.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Clients"
	intro="Everyone you work with lives on the Clients page. Adding someone takes just a name and an email; you can fill in the rest whenever you like."
>
	<h3>Adding a client</h3>
	<p>
		On <a href="/clients">Clients</a>, press <strong>+ Add client</strong> and enter their first and
		last name, their email and, optionally, their rate per session. Press
		<strong>Add &amp; invite client</strong> and they're emailed a private invite link to set up
		their portal login.
	</p>
	<ul>
		<li>
			If the invite email can't be delivered, the client is still saved and the page shows the
			invite link, so you can send it to them yourself (on WhatsApp, for example).
		</li>
		<li>
			Until they accept, their card says <strong>Invite pending</strong>. Use
			<strong>Resend invite</strong> to send it again. Once they've joined, it says
			<strong>Portal access</strong>.
		</li>
	</ul>

	<h3>Adding more information with Edit</h3>
	<p>
		Press <strong>Edit</strong> on a client's card to add everything the invite didn't need:
	</p>
	<ul>
		<li>
			<strong>Your own headings</strong>: set up to 20 in Settings → Client Profile Fields (for example
			"Presenting concerns" or "Medication"), and each one becomes an optional notes box here and when
			adding a client. Only you see them.
		</li>
		<li>
			<strong>From the client</strong>: their date of birth, gender and location, which they give when
			accepting the invite. You can see these but only the client can change them, from their portal.
		</li>
		<li>
			<strong>Rate</strong>: what one session costs this client. Every session booked for them is
			invoiced at this rate, and late-cancellation fees are worked out from it. Different clients
			can have different rates.
		</li>
		<li><strong>Tags</strong> to group clients however suits you (for example "couples" or "sliding scale").</li>
		<li>
			<strong>Status</strong>:
			<Badge tone="success">active</Badge> for current clients,
			<Badge tone="warning">paused</Badge> for someone taking a break, and
			<Badge tone="danger">left</Badge> for someone who has finished. A client marked
			<strong>left</strong> can no longer book and stops counting towards your plan's client limit.
		</li>
	</ul>

	<h3>Payments and deleting</h3>
	<p>
		<strong>View payments</strong> shows that client's full invoice history.
		<strong>Delete</strong> permanently removes the client. If you might work with them again, set
		them to <strong>left</strong> instead.
	</p>

	<GuideCallout title="Client limits">
		<p>
			Each plan allows a set number of clients (see <a href="#plans">Plans</a>). If you reach the
			limit, upgrade or mark clients who've finished as <strong>left</strong> to free up space.
		</p>
	</GuideCallout>
</GuideSection>
