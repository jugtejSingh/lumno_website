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
			<strong>Weekly slots</strong>: pick a day and press <strong>+ Add slot</strong>. Each slot has
			its own start and end time and is Online, In person, or Client picks (the client chooses when
			booking). Changes save as you make them. Use <strong>Copy to…</strong> to repeat a day across
			the week. A day with no slots is a day off.
		</li>
		<li>
			<strong>Max sessions</strong>: cap how many sessions can be booked on a day, even if more
			slots are open.
		</li>
		<li>
			<strong>Overlapping slots</strong>: two open slots can overlap. Once one is booked, the other
			is hidden for that date.
		</li>
		<li>
			<strong>Deleting an open slot</strong> keeps any sessions already booked in it. Clients just
			can't book that time any more.
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

	<h3>Reserving a slot for one client</h3>
	<p>
		For a client you see at the same time every week, set a weekly slot's dropdown from
		<strong>Open to everyone</strong> to <strong>Reserved: their name</strong>. They're then booked
		into that slot every week automatically, up to 14 days ahead, and no other client ever sees it.
		Each of those sessions is invoiced like any other, or uses a pack credit if they have one.
	</p>
	<ul>
		<li>Only Online or In person slots can be reserved, not Client picks.</li>
		<li>A reserved slot can't overlap another slot on the same day.</li>
		<li>
			If a week can't be booked because something is already in that time, you're told how many
			weeks were blocked.
		</li>
		<li>
			<strong>Changing a reserved slot</strong> (its time, day or type, a different client, opening
			it to everyone, or deleting it) deletes that client's future sessions on it, along with their
			unpaid charges, and gives back any pack credits. No cancellation fee is charged. Past sessions
			and any week the client cancelled or moved themselves are kept.
		</li>
		<li>
			If the client moves one of these sessions from their portal, the new time becomes an ordinary
			booking.
		</li>
	</ul>

	<h3>A note for your clients</h3>
	<p>
		Under the calendar, <strong>Note for your clients</strong> is shown above the booking calendar in
		every client's portal, for example "Payment must be made before the session starts". Your
		cancellation and reschedule policies are already shown to clients, so there's no need to repeat
		them here.
	</p>

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
