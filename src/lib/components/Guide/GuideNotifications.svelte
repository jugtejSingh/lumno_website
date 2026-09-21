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
			<strong>Booking emails</strong>: when a session is booked, moved or cancelled, whether the client
			did it or you did.
		</li>
		<li><strong>Session reminders</strong>: an email 24 hours before each session.</li>
		<li>
			<strong>Payment reminders</strong>: at most once a week, clients with an unpaid balance get an
			email listing what they owe.
		</li>
		<li>
			<strong>Google Meet links</strong>: added to online sessions and included in the booking email,
			once Google Calendar is connected.
		</li>
	</ul>
	<p>
		Emails only go to clients who have an email address on file. Clients can also add a phone number
		in their portal for WhatsApp reminders.
	</p>
</GuideSection>
