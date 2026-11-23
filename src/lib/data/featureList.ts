import type { Feature } from '$lib/types/home';

// every feature Lumno has, laid out row by row for the homepage bento.
// each row is 4 columns wide: span 2 = big, 1 = small. A row's spans must add up to 4.
export const featureRows: Feature[][] = [
	[
		{
			name: 'Self-booking',
			line: "Clients pick a time you're free and it lands straight in your calendar. They never see why other slots are taken.",
			icon: 'calendar',
			accent: 'coral',
			span: 2
		},
		{
			name: 'Google Meet links',
			line: 'Every session comes with a Meet link, already made.',
			icon: 'calendar',
			accent: 'coral',
			span: 1
		},
		{
			name: 'Availability',
			line: 'Weekly hours, days off and a daily session cap.',
			icon: 'calendar',
			accent: 'coral',
			span: 1
		}
	],
	[
		{
			name: 'Reserved slots',
			line: 'Hold a regular time for a regular client.',
			icon: 'calendar',
			accent: 'coral',
			span: 1
		},
		{
			name: 'Session reminders',
			line: 'WhatsApp a day before, or email. Fewer no-shows.',
			icon: 'reminders',
			accent: 'citrus',
			span: 1
		},
		{
			name: 'Check-ins',
			line: 'A gentle email at day 14 and 28 if someone stops booking.',
			icon: 'reminders',
			accent: 'citrus',
			span: 1
		},
		{
			name: 'Dashboard',
			line: "This week's sessions, overdue notes and money owed.",
			icon: 'dashboard',
			accent: 'plum',
			span: 1
		}
	],
	[
		{
			name: 'Payment nudges',
			line: 'Anyone who owes gets a polite reminder, once a week at most.',
			icon: 'reminders',
			accent: 'sage',
			span: 1
		},
		{
			name: 'Refunds',
			line: 'Refund a session and track it until it settles.',
			icon: 'payments',
			accent: 'sage',
			span: 1
		},
		{
			name: 'Payments',
			line: 'Clients pay online or by UPI and sessions mark themselves paid. 0% commission from Lumno.',
			icon: 'payments',
			accent: 'sage',
			span: 2
		}
	],
	[
		{
			name: 'Invoices',
			line: 'A clean invoice in a minute, whenever a client asks.',
			icon: 'payments',
			accent: 'sage',
			span: 1
		},
		{
			name: 'Session notes',
			line: 'Private notes for every session, kept with each client and readable only by you.',
			icon: 'notes',
			accent: 'plum',
			span: 2
		},
		{
			name: 'AI fix',
			line: 'One button tidies the wording. Only runs when you press it.',
			icon: 'notes',
			accent: 'plum',
			span: 1
		}
	],
	[
		{
			name: 'Ask AI',
			line: "Ask questions about a client's notes and get answers in seconds.",
			icon: 'notes',
			accent: 'plum',
			span: 1
		},
		{
			name: 'Shared notes',
			line: 'Share a note with your client, only when you choose.',
			icon: 'notes',
			accent: 'plum',
			span: 1
		},
		{
			name: 'Intake forms',
			line: 'Build your own form, share one link, and turn a reply into a client in one click.',
			icon: 'clients',
			accent: 'citrus',
			span: 2
		}
	],
	[
		{
			name: 'Client profiles',
			line: 'Sessions, notes and balance for each client.',
			icon: 'clients',
			accent: 'citrus',
			span: 1
		},
		{
			name: 'Client portal',
			line: 'Clients book, pay and read what you share from their own login.',
			icon: 'clients',
			accent: 'citrus',
			span: 1
		},
		{
			name: 'Shared resources',
			line: "Worksheets and links that stay in your client's portal.",
			icon: 'clients',
			accent: 'citrus',
			span: 1
		},
		{
			name: 'Referrals',
			line: 'Find colleagues by specialty and refer with confidence.',
			icon: 'dashboard',
			accent: 'coral',
			span: 1
		}
	]
];
