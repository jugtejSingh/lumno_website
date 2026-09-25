<script lang="ts">
	import GuideSection from './GuideSection.svelte';
	import GuideCallout from './GuideCallout.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Why clients get a login"
	intro="Every client you invite gets their own private portal. It's the one place where they book with you, see what they owe and how to pay you, and read what you've sent them, so admin doesn't pile up in your messages."
>
	<h3>Only your clients can book</h3>
	<p>
		No one can book a session with you unless you've invited them. There's no public booking page
		for strangers to find, so every session on your calendar is someone you've already agreed to see
		and set a rate for.
	</p>

	<h3>A built-in, gentle reminder to pay you</h3>
	<p>
		Whenever a client logs in, their <strong>balance due</strong> and every unpaid invoice are right
		there, next to your QR code and bank details. You don't have to chase anyone: the reminder is
		waiting every time they come to book. You can also have the app email them a weekly reminder
		while they have a balance (see <a href="#notifications">Notifications</a>).
	</p>

	<GuideCallout title="Make sure everything's settled before the next session">
		<p>
			Turn on <strong>Block portal bookings while a client owes you money</strong> in
			<a href="/settings">Settings → Booking Rules</a>. A client with an unpaid invoice then can't book
			a new session until it's paid. You can still add sessions for them yourself on the Calendar.
		</p>
		<p>
			You can also cap <strong>Upcoming Sessions Per Client</strong> at 1, 2 or 3, so no one books
			out your whole fortnight ahead of time.
		</p>
	</GuideCallout>

	<h3>What clients see in their portal</h3>
	<ul>
		<li>
			<strong>Their upcoming sessions</strong>, with a Google Meet link for online ones, plus
			<strong>Reschedule</strong> and <strong>Cancel</strong> buttons. Your cancellation and reschedule
			policies are shown right under the calendar, so late fees are never a surprise.
		</li>
		<li>
			<strong>Your note for clients</strong>, if you've written one, above the booking calendar.
		</li>
		<li>
			<strong>Their pack</strong>: how many sessions are left, or that it's used up and the next
			sessions are at the regular price. If they move a pack session too late and have no credits
			left, they're warned it'll be charged before they confirm.
		</li>
		<li>
			<strong>A calendar of open slots</strong> for the next 14 days. It only shows times that are
			free. It never shows <em>why</em> a time is taken, so one client can't work out anything about
			another client's sessions.
		</li>
		<li>
			<strong>Payments</strong>: their balance, unpaid invoices, your QR code and bank details, and a
			<strong>Pay now</strong> button if you've connected Razorpay.
		</li>
		<li>
			<strong>Notes &amp; homework</strong> you've chosen to share with them. Your private notes are
			never shown.
		</li>
		<li>
			<strong>Resources</strong>: files and links you've added for them, and they can add their own
			(see <a href="#clients">Clients</a>).
		</li>
		<li>
			<strong>Their details</strong>: they can add a phone number for WhatsApp reminders.
		</li>
	</ul>
</GuideSection>
