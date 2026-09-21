<script lang="ts">
	import GuideToc from '$lib/components/Guide/GuideToc.svelte';
	import GuideGettingStarted from '$lib/components/Guide/GuideGettingStarted.svelte';
	import GuideClients from '$lib/components/Guide/GuideClients.svelte';
	import GuidePortal from '$lib/components/Guide/GuidePortal.svelte';
	import GuideCalendar from '$lib/components/Guide/GuideCalendar.svelte';
	import GuidePayments from '$lib/components/Guide/GuidePayments.svelte';
	import GuideNotes from '$lib/components/Guide/GuideNotes.svelte';
	import GuideAi from '$lib/components/Guide/GuideAi.svelte';
	import GuideNotifications from '$lib/components/Guide/GuideNotifications.svelte';
	import GuideCommunity from '$lib/components/Guide/GuideCommunity.svelte';
	import GuidePlans from '$lib/components/Guide/GuidePlans.svelte';

	// order here is the order on the page; ids are the #anchors the sections link to each other with
	const sections = [
		{ id: 'getting-started', title: 'Getting started', component: GuideGettingStarted },
		{ id: 'clients', title: 'Clients', component: GuideClients },
		{ id: 'portal', title: 'Why clients get a login', component: GuidePortal },
		{ id: 'calendar', title: 'Calendar & scheduling', component: GuideCalendar },
		{ id: 'payments', title: 'Payments', component: GuidePayments },
		{ id: 'notes', title: 'Notes', component: GuideNotes },
		{ id: 'ai', title: 'AI help with notes', component: GuideAi },
		{ id: 'notifications', title: 'Notifications', component: GuideNotifications },
		{ id: 'community', title: 'Community', component: GuideCommunity },
		{ id: 'plans', title: 'Plans', component: GuidePlans }
	];
</script>

<svelte:head>
	<title>Guide — Lumno</title>
</svelte:head>

<div class="guide">
	<div class="header">
		<div class="title">Guide</div>
		<div class="subtitle">How everything in the app works, and how it fits together.</div>
	</div>

	<div class="layout">
		<aside class="toc-col">
			<GuideToc {sections} />
		</aside>
		<div class="sections">
			{#each sections as s, i (s.id)}
				<s.component id={s.id} number={i + 1} />
			{/each}
		</div>
	</div>
</div>

<style>
	.guide {
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 1080px;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(24px, 5vw, 32px);
		color: var(--text-primary);
	}

	.subtitle {
		font-size: 13px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	.layout {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}

	.toc-col {
		position: sticky;
		top: 0;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 760px;
	}

	@media (max-width: 960px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.toc-col {
			position: static;
		}
	}
</style>
