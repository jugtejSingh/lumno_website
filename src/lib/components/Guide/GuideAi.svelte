<script lang="ts">
	import GuideSection from './GuideSection.svelte';
	import GuideCallout from './GuideCallout.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="AI help with notes"
	intro="Jot your notes down however they come out between sessions. AI can tidy them up, summarise them, turn them into something you can share with the client, and answer questions about a client. AI is included on the Basic and Pro plans, not on Free."
>
	<h3>✨ Fix: tidy up your writing</h3>
	<p>
		Fix corrects grammar, spelling and punctuation in the note you're writing and makes it read more
		clearly, then puts the result back in the editor. It only works with what you wrote: it never adds
		facts, symptoms or events that aren't already in the note. Read it through before saving, because
		nothing is saved until you press save.
	</p>

	<h3>📝 Describe: a one-line summary for the card</h3>
	<p>
		Describe writes a short summary of the note. It shows as the note's headline in your list, so you
		can scan a client's history at a glance without opening every note. The full note stays the same.
	</p>

	<h3>Send to client: a version of a private note that's safe to share</h3>
	<p>
		Open a private note and press <strong>Send to client</strong>. AI drafts a version written for the
		client and opens it as a new note for the client, linked to the same session. Nothing is sent
		yet: read it, change anything you like, and only then send it. Your private note stays as it is.
	</p>

	<h3>Chat: ask about a client</h3>
	<p>
		Press <strong>Chat</strong> in a client's notes to ask questions such as "what did we agree on
		for homework last month?". Answers come only from that client's private notes. The chat isn't
		saved: closing it or reloading the page starts it over.
	</p>

	<GuideCallout title="Privacy">
		<p>
			Session notes are health information. The AI only sends them to providers that don't use what
			they receive to train AI models.
		</p>
	</GuideCallout>

	<p>
		AI use has a generous monthly limit per account. If you reach it, the buttons show a message and
		start working again at the start of the next month. Writing and saving notes is never affected.
	</p>
</GuideSection>
