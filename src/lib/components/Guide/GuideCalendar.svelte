<script lang="ts">
	import GuideSection from './GuideSection.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Calendar & scheduling"
	intro="Clients book themselves into the open slots your schedule creates, and you can add, move or cancel any session yourself from the Calendar."
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

	<h3>How your schedule becomes bookable slots</h3>
	<p>Everything in <a href="/settings">Settings → Schedule</a> shapes what clients can book:</p>
	<ul>
		<li><strong>Session length</strong>: how long a session booked through the portal lasts.</li>
		<li>
			<strong>Buffer between sessions</strong>: breathing room after each session. With 60-minute
			sessions and a 5-minute buffer, slots start at 9:00, 10:05, 11:10.
		</li>
		<li>
			<strong>Working hours</strong>: the first slot starts at your "from" time and the last one must
			finish by your "to" time.
		</li>
		<li>
			<strong>Weekly pattern</strong>: each weekday is Online, In Person, Hybrid (the client picks
			when booking) or Holiday (nothing can be booked).
		</li>
	</ul>
	<p>Clients can book up to <strong>14 days</strong> ahead.</p>

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
		<strong>Notes</strong> button that takes you straight to that client's notes.
	</p>
</GuideSection>
