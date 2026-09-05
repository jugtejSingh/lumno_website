<script lang="ts">
	import Nav from '$lib/components/utils/Nav.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Hero from '$lib/components/Home/Hero.svelte';
	import FeaturesSection from '$lib/components/Home/FeaturesSection.svelte';
	import SnippetsSection from '$lib/components/Home/SnippetsSection.svelte';
	import CtaBand from '$lib/components/Home/CtaBand.svelte';
	import type { PreviewPanel, Feature } from '$lib/types/home';

	const panels: PreviewPanel[] = [
		{
			kind: 'booking',
			label: 'Booking',
			weeks: [
				[
					{ day: null },
					{ day: null },
					{ day: null },
					{ day: 1 },
					{ day: 2 },
					{ day: 3 },
					{ day: 4 }
				],
				[
					{ day: 5 },
					{ day: 6 },
					{ day: 7 },
					{ day: 8, sessions: [{ time: '11:00', name: 'Maria Chen', color: 'plum' }] },
					{ day: 9 },
					{ day: 10 },
					{ day: 11 }
				],
				[
					{ day: 12 },
					{ day: 13 },
					{
						day: 14,
						isToday: true,
						sessions: [
							{ time: '9:30', name: 'Priya Nair', color: 'sage' },
							{ time: '2:00', name: 'Maria Chen', color: 'plum' },
							{ time: '4:30', name: 'James Okoro', color: 'coral' }
						]
					},
					{ day: 15 },
					{ day: 16, sessions: [{ time: '1:00', name: 'James Okoro', color: 'coral' }] },
					{ day: 17 },
					{ day: 18 }
				],
				[
					{ day: 19 },
					{ day: 20 },
					{ day: 21, sessions: [{ time: '10:00', name: 'Diego Alvarez', color: 'sage' }] },
					{ day: 22 },
					{ day: 23 },
					{ day: 24 },
					{ day: 25 }
				],
				[
					{ day: 26 },
					{ day: 27 },
					{ day: 28 },
					{ day: 29 },
					{ day: 30 },
					{ day: 31 },
					{ day: null }
				]
			]
		},
		{
			kind: 'payments',
			label: 'Payments',
			collected: '₹2,340',
			paymentsLeft: 4,
			breakdown: [
				{ client: 'Maria Chen', amount: '₹480.00', status: 'paid' },
				{ client: 'Priya Nair', amount: '₹360.00', status: 'paid' },
				{ client: 'James Okoro', amount: '₹120.00', status: 'owed', reminderSent: true },
				{ client: 'Diego Alvarez', amount: '₹80.00', status: 'owed', reminderSent: false }
			]
		},
		{
			kind: 'notes',
			label: 'Notes',
			client: 'Priya Nair',
			rawNote:
				'client seemed better today. anxiety down. sleep ok now. talked about work stress again, mentioned boss issue. gave breathing exercise hw',
			cleanedNote:
				'Client reports improved mood and steadier sleep. Anxiety trending down. Continued stress related to workplace dynamics with supervisor. Assigned breathing exercise as homework.',
			homework: 'Practice the 4-7-8 breathing exercise nightly before bed.'
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
			title: 'Reminders',
			desc: 'Automated reminders for upcoming sessions and payments that are due — sent without you lifting a finger.',
			cta: 'Open calendar',
			href: '/calendar',
			icon: 'reminders',
			accent: 'citrus'
		},
		{
			title: 'Client notes',
			desc: 'A clean writing space with basic formatting, kept dated and organized per client.',
			cta: 'Open notes',
			href: '/notes',
			icon: 'notes',
			accent: 'plum'
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
	<Hero {panels} />
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