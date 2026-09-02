export type Stat = {
	label: string;
	value: string;
	accent: 'plum' | 'coral';
};

export type Session = {
	name: string;
	time: string;
	tag: string;
	tone: 'success' | 'warning';
	note: string;
};

export type Feature = {
	title: string;
	desc: string;
	cta: string;
	href: string;
	icon: 'dashboard' | 'calendar' | 'payments' | 'notes' | 'clients' | 'referrals' | 'login';
	accent: 'plum' | 'coral' | 'sage' | 'citrus';
};

export type Snippet = {
	eyebrow: string;
	title: string;
	desc: string;
	cta: string;
	href: string;
};