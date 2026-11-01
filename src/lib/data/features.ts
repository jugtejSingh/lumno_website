import BookingVisual from '$lib/components/Home/features/BookingVisual.svelte';
import SessionReminderVisual from '$lib/components/Home/features/SessionReminderVisual.svelte';
import PaymentsVisual from '$lib/components/Home/features/PaymentsVisual.svelte';
import CheckInVisual from '$lib/components/Home/features/CheckInVisual.svelte';
import NotesVisual from '$lib/components/Home/features/NotesVisual.svelte';
import DashboardVisual from '$lib/components/Home/features/DashboardVisual.svelte';
import ClientsVisual from '$lib/components/Home/features/ClientsVisual.svelte';
import CommunityVisual from '$lib/components/Home/features/CommunityVisual.svelte';
import type { Feature } from '$lib/types/home';

// the jobs Lumno does on its own come first; that's what nobody can do by hand every week
export const features: Feature[] = [
	{
		tab: 'Bookings',
		title: 'Clients book themselves',
		desc: "Share your link and clients pick from the times you're free. The session goes straight into your calendar with a Google Meet link already made.",
		points: [
			'Clients only ever see your open times',
			'A Meet link for every session',
			'No back-and-forth to find a slot'
		],
		cta: 'Open calendar',
		href: '/calendar',
		icon: 'calendar',
		accent: 'coral',
		automatic: true,
		visual: BookingVisual
	},
	{
		tab: 'Reminders',
		title: 'Reminders you never type',
		desc: 'A day before every session, your client gets a reminder on WhatsApp, or by email if there is no number, in their own timezone.',
		points: [
			'Sent 24 hours before each session',
			'WhatsApp first, email as the backup',
			'Switch it off any time in settings'
		],
		cta: 'See reminder settings',
		href: '/settings',
		icon: 'reminders',
		accent: 'citrus',
		automatic: true,
		visual: SessionReminderVisual
	},
	{
		tab: 'Payments',
		title: 'Payments that chase themselves',
		desc: 'Clients pay online and the session marks itself paid, with 0% commission from Lumno. Anyone who still owes gets a polite nudge, never more than once a week.',
		points: [
			'Paid sessions update on their own',
			'At most one payment reminder a week',
			'UPI QR or bank details if they prefer'
		],
		cta: 'Open payments',
		href: '/payments',
		icon: 'payments',
		accent: 'sage',
		automatic: true,
		visual: PaymentsVisual
	},
	{
		tab: 'Check-ins',
		title: 'A gentle nudge when someone drifts',
		desc: "If a client hasn't booked in a while, Lumno sends one short email after two weeks and one more after four. Then it stops, so nobody ever feels chased.",
		points: [
			'Day 14, then day 28, then nothing',
			'Stops the moment they book again',
			'Switch it off whenever you like'
		],
		cta: 'See reminder settings',
		href: '/settings',
		icon: 'heart',
		accent: 'plum',
		automatic: true,
		visual: CheckInVisual
	},
	{
		tab: 'Notes',
		title: 'Notes in minutes, not evenings',
		desc: 'Type or dictate however it comes out. Press one button and AI tidies the wording, then send your client a gentle recap if you choose to.',
		points: [
			'AI only runs when you press the button',
			'Your private notes stay private',
			'Recaps go out only when you decide'
		],
		cta: 'Open notes',
		href: '/notes',
		icon: 'notes',
		accent: 'plum',
		automatic: false,
		visual: NotesVisual
	},
	{
		tab: 'Dashboard',
		title: 'Your week at a glance',
		desc: "Log in and see this week's sessions, the notes that are overdue and what's still owed, without piecing it together from three apps.",
		points: ['Sessions this week', 'Notes overdue', 'Outstanding balance'],
		cta: 'Open dashboard',
		href: '/dashboard',
		icon: 'dashboard',
		accent: 'coral',
		automatic: false,
		visual: DashboardVisual
	},
	{
		tab: 'Clients',
		title: 'Every client in one place',
		desc: 'Contact details, upcoming sessions, notes and what each client owes, all a click away instead of spread across chats and spreadsheets.',
		points: [
			'One list for your whole practice',
			'History and notes per client',
			'Balances at a glance'
		],
		cta: 'Open clients',
		href: '/clients',
		icon: 'clients',
		accent: 'sage',
		automatic: false,
		visual: ClientsVisual
	},
	{
		tab: 'Referrals',
		title: 'Refer with confidence',
		desc: 'Find colleagues on Lumno, see what they specialise in, and pass on a client who needs a different fit.',
		points: [
			'Colleagues and their specialties',
			'Refer in a couple of clicks',
			'Nobody left without help'
		],
		cta: 'Open community',
		href: '/community',
		icon: 'referrals',
		accent: 'citrus',
		automatic: false,
		visual: CommunityVisual
	}
];
