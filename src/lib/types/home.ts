export type BookingDay = {
	day: number | null;
	isToday?: boolean;
	sessions?: { time: string; name: string; color: 'plum' | 'coral' | 'sage' }[];
};

export type BookingPreview = {
	kind: 'booking';
	label: string;
	weeks: BookingDay[][];
};

export type PaymentsPreview = {
	kind: 'payments';
	label: string;
	collected: string;
	paymentsLeft: number;
	breakdown: { client: string; amount: string; status: 'paid' | 'owed'; reminderSent?: boolean }[];
};

export type NotesPreview = {
	kind: 'notes';
	label: string;
	client: string;
	rawNote: string;
	cleanedNote: string;
	homework: string;
};

export type PreviewPanel = BookingPreview | PaymentsPreview | NotesPreview;

export type Feature = {
	title: string;
	desc: string;
	cta: string;
	href: string;
	icon:
		| 'dashboard'
		| 'calendar'
		| 'payments'
		| 'notes'
		| 'clients'
		| 'referrals'
		| 'login'
		| 'reminders';
	accent: 'plum' | 'coral' | 'sage' | 'citrus';
};

export type Snippet = {
	eyebrow: string;
	title: string;
	desc: string;
	cta: string;
	href: string;
};
