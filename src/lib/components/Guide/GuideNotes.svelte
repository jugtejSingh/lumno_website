<script lang="ts">
	import GuideSection from './GuideSection.svelte';
	import Tag from '$lib/components/utils/Tag.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Notes"
	intro="Each client has two kinds of notes: private notes only you can read, and notes you send to the client, which appear in their portal. Both can be linked to a session so you can always see what was covered when."
>
	<h3>Private notes vs notes for the client</h3>
	<ul>
		<li>
			<strong>Private notes</strong> (<strong>New note</strong>) are your clinical notes. Only you
			can see them, and they're never shown to the client.
		</li>
		<li>
			<strong>Sent to client</strong> (<strong>New for client</strong>) is for homework, summaries
			or resources. Pressing <strong>Send to client</strong> shows it in their portal straight away.
			These notes carry a <Tag color="sage">Visible to client</Tag> tag so you never mix the two up.
		</li>
	</ul>

	<h3>Linking a note to a session</h3>
	<p>
		When you write a note, <strong>Link a session</strong> lets you choose one of that client's past
		sessions. The note card then shows a <Tag color="plum">Session: …</Tag> tag, so your notes build
		a timeline you can follow session by session.
	</p>
	<p>
		Linking also drives <strong>Notes overdue</strong> on your <a href="/dashboard">Dashboard</a>. It
		counts sessions from this week and last week that don't have a note linked to them yet. Write the
		note, link it to the session, and the count goes down. The <strong>Notes</strong> button next to
		each session on the Dashboard takes you straight to that client's notes.
	</p>

	<h3>Writing and formatting</h3>
	<p>
		The toolbar adds <strong>bold</strong>, <em>italics</em>, headings and bullet lists. Notes show
		as short cards, and clicking one expands it to the full text with an <strong>Edit</strong> button.
		Editing keeps the note's original date.
	</p>
	<p>
		If your connection drops while you're saving, the app retries a few times on its own. If it still
		can't save, your writing stays on screen so nothing is lost.
	</p>
</GuideSection>
