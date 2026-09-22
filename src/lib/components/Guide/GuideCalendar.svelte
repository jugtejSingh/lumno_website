<script lang="ts">
	import GuideSection from './GuideSection.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Calendar & scheduling"
	intro="Clients book themselves into the open slots you build, and you can add, move or cancel any session yourself from the Calendar."
>
	<h3>Adding a session yourself</h3>
	<p>
		On the <a href="/calendar">Calendar</a>, click a day and press <strong>+ Add appointment</strong>.
		Pick one of your clients, or type a name for a one-off walk-in who isn't a client (you can give a
		walk-in their own rate). Set the start and end time, choose online or in person, and add a note
		if you like. Sessions you add can be any length and aren't limited by your booking rules.
	</p>

	<h3>Rescheduling and cancelling</h3>
	<ul>
		<li>
			Open a day to <strong>Reschedule</strong> or <strong>Cancel</strong> any session on it. Clients
			can do the same from their portal.
		</li>
		<li>
			If the session has <strong>already happened</strong>, cancelling asks how much to charge: 0%,
			50% or 100% of the client's rate.
		</li>
		<li>
			When a client cancels or moves a session at short notice, your cancellation policy decides the
			fee (see <a href="#payments">Payments</a>).
		</li>
	</ul>

	<h3>Building your bookable slots</h3>
	<p>Clients can only book the slots you build on the <a href="/calendar">Calendar</a>:</p>
	<ul>
		<li>
			<strong>Weekly slots</strong>: set the slots for each day of the week. Each slot has its own
			start and end time and is Online, In person, or Client picks (the client chooses when booking).
			Use <strong>Copy to…</strong> to repeat a day across the week. A day with no slots is a day off.
		</li>
		<li>
			<strong>One date</strong>: click a day to give just that date its own slots, make it a day off,
			or go back to your weekly slots.
		</li>
		<li>
			<strong>Breaks</strong>: leave a gap between slots, for example 1:00–2:00 then 2:30–3:30.
		</li>
		<li>
			<strong>Holidays</strong>: mark a weekday a holiday in <strong>Your weekly slots</strong> and
			clients can't book that weekday, though its slots stay saved for when you switch it back. A
			specific date you've edited on the calendar keeps its own slots regardless.
		</li>
	</ul>
	<p>Clients can book up to <strong>14 days</strong> ahead and only see slots that are still open.</p>

	<h3>Google Meet links</h3>
	<p>
		Connect Google Calendar at the bottom of <a href="/settings">Settings</a> and keep
		<strong>Add a Google Meet link to online sessions</strong> switched on. Every online session then
		gets a Meet link, which appears in the client's booking email and in their portal.
	</p>

	<h3>Your dashboard</h3>
	<p>
		The <a href="/dashboard">Dashboard</a> shows your sessions this week, how many notes are overdue,
		your total outstanding balance and your upcoming sessions. Each session has a
		<strong>Notes</strong> button that takes you straight to that client's notes. Click the
		<strong>Notes overdue</strong> card to see who's missing a note from a session this week.
	</p>
</GuideSection>
