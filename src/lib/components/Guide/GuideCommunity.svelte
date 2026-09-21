<script lang="ts">
	import GuideSection from './GuideSection.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Community"
	intro="A directory of other therapists on the app, so that when someone needs a different fit you have a colleague to refer them to, and colleagues can find you too. It's in beta."
>
	<h3>Finding a colleague</h3>
	<p>
		On <a href="/community">Community</a>, search by name or specialty and click a card to read the
		therapist's full profile.
	</p>

	<h3>Your own card</h3>
	<p>
		Fill in <a href="/settings">Settings → Community Profile</a>: your specialties, a short bio, your
		session format and location. Under <strong>Community Visibility</strong> you decide whether you're
		listed at all, and whether your years of experience and session rate appear on your card.
	</p>
	<p>
		Clients never see the Community page or your card. The session rate there is only shown to other
		therapists and doesn't change what any client pays.
	</p>
</GuideSection>
