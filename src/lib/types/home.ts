export type Accent = 'plum' | 'coral' | 'sage' | 'citrus';

export type FeatureIconName =
	'dashboard' | 'calendar' | 'payments' | 'notes' | 'clients' | 'reminders';

export type Feature = {
	name: string;
	// one short line on what having this feature means for the therapist
	line: string;
	icon: FeatureIconName;
	accent: Accent;
	// columns taken in its 4-column bento row: 2 = big, 1 = small
	span: 1 | 2;
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
	accent: Accent;
};
