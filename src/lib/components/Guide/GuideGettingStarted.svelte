<script lang="ts">
	import GuideSection from './GuideSection.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Getting started"
	intro="A short checklist that gets your practice ready before your first client logs in. Each step takes a minute or two, and you can come back and change any of it later."
>
	<ol>
		<li>
			<strong>Set your schedule.</strong> In <a href="/settings">Settings → Schedule</a>, choose your
			session length, the gap between sessions, your working hours and what each day of the week
			looks like (online, in person, hybrid or a day off). This decides which times clients can book.
		</li>
		<li>
			<strong>Tell clients how to pay you.</strong> In
			<a href="/settings">Settings → How Clients Pay You</a>, upload your UPI / payment QR code and add
			your bank details. Clients see these next to anything they owe.
		</li>
		<li>
			<strong>Pick your booking rules.</strong> In <a href="/settings">Settings → Booking Rules</a>,
			decide whether clients who owe you money can still book, and how many upcoming sessions one
			client can hold at a time.
		</li>
		<li>
			<strong>Set your cancellation policy.</strong> In <a href="/settings">Settings → Payments</a>,
			choose how much notice a client must give to cancel or reschedule for free.
		</li>
		<li>
			<strong>Connect Google Calendar</strong> (optional) at the bottom of
			<a href="/settings">Settings</a>, so online sessions get a Google Meet link automatically.
		</li>
		<li>
			<strong>Add your first client</strong> on the <a href="/clients">Clients</a> page. They get an
			email invite to their own portal.
		</li>
	</ol>
</GuideSection>
