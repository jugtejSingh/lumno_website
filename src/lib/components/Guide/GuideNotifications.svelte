<script lang="ts">
	import GuideSection from './GuideSection.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Notifications"
	intro="The app sends clients the routine emails for you, so you don't have to. Each one can be turned on or off in Settings → Notifications."
>
	<ul>
		<li>
			<strong>Booking emails</strong>: when a session is booked, moved or cancelled, whether the
			client did it or you did.
		</li>
		<li>
			<strong>Session reminders</strong>: an email 24 hours before each session, with a link to the
			client's portal.
		</li>
		<li>
			<strong>Payment reminders</strong>: at most once a week, clients with an unpaid balance get an
			email listing what they owe, with a link to their portal.
		</li>
		<li>
			<strong>Rebook reminders</strong>: when a client hasn't booked their next session, a friendly
			nudge 2 weeks after their last one and one more at 4 weeks. After that they stop.
			Only active clients get these, and they stop as soon as a new session is booked.
		</li>
		<li>
			<strong>Google Meet links</strong>: added to online sessions and included in the booking
			email, once Google Calendar is connected.
		</li>
	</ul>
	<p>
		Emails only go to clients who have an email address on file. Clients can also add and verify a
		phone number in their portal. Once it's verified, their reminders go by WhatsApp instead of
		email.
	</p>
</GuideSection>
