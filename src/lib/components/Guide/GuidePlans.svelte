<script lang="ts">
	import GuideSection from './GuideSection.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Plans"
	intro="Every plan includes unlimited appointments. The main difference between them is how many clients you can have."
>
	<ul>
		<li><strong>Free</strong>: up to 10 clients.</li>
		<li><strong>Basic</strong>: up to 30 clients.</li>
		<li><strong>Pro</strong>: unlimited clients.</li>
	</ul>
	<p>
		Clients marked <strong>left</strong> don't count towards the limit. If you move to a smaller plan
		while you have more clients than it allows, the extra clients keep their existing sessions but
		can't book new ones until you upgrade or free up space.
	</p>
	<p>
		See prices on the <a href="/pricing">Pricing</a> page, and manage or cancel your plan in
		<a href="/settings">Settings → Plan</a>.
	</p>
</GuideSection>
