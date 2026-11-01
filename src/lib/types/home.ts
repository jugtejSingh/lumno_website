import type { Component } from 'svelte';

export type Feature = {
	// short label for the tab that opens this feature
	tab: string;
	title: string;
	desc: string;
	points: string[];
	cta: string;
	href: string;
	icon:
		| 'dashboard'
		| 'calendar'
		| 'payments'
		| 'notes'
		| 'clients'
		| 'referrals'
		| 'reminders'
		| 'heart';
	accent: 'plum' | 'coral' | 'sage' | 'citrus';
	// true for the jobs Lumno does without the therapist lifting a finger
	automatic: boolean;
	visual: Component;
};

export type Testimonial = {
	quote: string;
	name: string;
	// handle without the @, used to link the name to their Instagram
	instagram: string;
	// a line or two about them shown under the name, e.g. practice and city
	about: string;
	// path under /static, e.g. '/testimonials/name.jpg'; initials are shown when missing
	image?: string;
	accent: 'plum' | 'coral' | 'sage' | 'citrus';
};
