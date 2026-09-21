<script lang="ts">
	import GuideSection from './GuideSection.svelte';
	import GuideCallout from './GuideCallout.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="AI help with notes"
	intro="Jot your notes down however they come out between sessions. Two buttons in the note editor can tidy them up and summarise them for you."
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

	<GuideCallout title="Privacy">
		<p>
			Session notes are health information. The AI only sends them to providers that don't keep or
			train on what they receive (zero data retention). If none of those providers is available, the
			request fails. It's never passed to a provider that would keep your data.
		</p>
	</GuideCallout>

	<p>
		AI use has a generous monthly limit per account. If you reach it, the buttons show a message and
		start working again at the start of the next month. Writing and saving notes is never affected.
	</p>
</GuideSection>
