export type SpecialtyTag = {
	label: string;
	color: 'plum' | 'coral' | 'sage' | 'citrus';
};

export type ReferralTherapist = {
	id: number;
	name: string;
	format: string;
	years: number;
	specialtyTags: SpecialtyTag[];
	bio: string;
	rate: string;
};
