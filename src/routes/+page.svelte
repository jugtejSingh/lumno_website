<script lang="ts">
	import Nav from '$lib/components/utils/Nav.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Hero from '$lib/components/Home/Hero.svelte';
	import FeaturesSection from '$lib/components/Home/FeaturesSection.svelte';
	import SnippetsSection from '$lib/components/Home/SnippetsSection.svelte';
	import CtaBand from '$lib/components/Home/CtaBand.svelte';
	import type { Stat, Session, Feature } from '$lib/types/home';

	const stats: Stat[] = [
		{ label: 'Sessions this week', value: '12', accent: 'plum' },
		{ label: 'New clients', value: '3', accent: 'coral' }
	];

	const sessions: Session[] = [
		{
			name: 'Maria Chen',
			time: 'Today · 2:00 PM',
			tag: 'confirmed',
			tone: 'success',
			note: 'Mood improved this week, sleep steadier than last check-in.'
		},
		{
			name: 'James Okoro',
			time: 'Tomorrow · 10:00 AM',
			tag: 'pending',
			tone: 'warning',
			note: 'Discussed communication patterns from last joint session.'
		},
		{
			name: 'Priya Nair',
			time: 'Thu · 9:30 AM',
			tag: 'confirmed',
			tone: 'success',
			note: 'Anxiety scale down to 4 out of 10, from 7 two weeks ago.'
		}
	];

	const features: Feature[] = [
		{
			title: 'Dashboard',
			desc: "Your day in one place — today's sessions, notes due, and what needs attention.",
			cta: 'Open dashboard',
			href: '/dashboard',
			icon: 'dashboard',
			accent: 'plum'
		},
		{
			title: 'Calendar & reminders',
			desc: "A large month view so you always know who's booked for what, plus reminder settings.",
			cta: 'Open calendar',
			href: '/calendar',
			icon: 'calendar',
			accent: 'coral'
		},
		{
			title: 'Payments',
			desc: "Configure how you get paid, and see exactly what's outstanding.",
			cta: 'Open payments',
			href: '/payments',
			icon: 'payments',
			accent: 'sage'
		},
		{
			title: 'Client notes',
			desc: 'A clean writing space with basic formatting, kept dated and organized per client.',
			cta: 'Open notes',
			href: '/notes',
			icon: 'notes',
			accent: 'citrus'
		},
		{
			title: 'Clients',
			desc: 'Every client on one list, with their contact details and history a click away.',
			cta: 'Open clients',
			href: '/clients',
			icon: 'clients',
			accent: 'plum'
		},
		{
			title: 'Referrals',
			desc: 'Invite other therapists and keep track of who joined through you.',
			cta: 'Open referrals',
			href: '/referrals',
			icon: 'referrals',
			accent: 'coral'
		},
		{
			title: 'Simple login',
			desc: 'Log in or set up your practice in about two minutes.',
			cta: 'Log in',
			href: '/login',
			icon: 'login',
			accent: 'sage'
		}
	];
</script>

<svelte:head>
	<title>Lumno — Run your practice, calmly.</title>
</svelte:head>

<div class="page">
	<Nav />
	<Hero {stats} {sessions} />
	<FeaturesSection {features} />
	<SnippetsSection />
	<CtaBand />
	<Footer />
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--surface-app);
		color: var(--text-primary);
		overflow-x: hidden;
	}
</style>