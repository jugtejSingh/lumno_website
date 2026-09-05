export type SpecialtyTag = {
	label: string;
	color: 'plum' | 'coral' | 'sage' | 'citrus';
};

export type ReferralTherapist = {
	id: string;
	name: string;
	format: string | null;
	location: string | null;
	years: number | null;
	specialtyTags: SpecialtyTag[];
	bio: string;
	rate: string | null;
};

export type ReferralListPage = {
	therapists: ReferralTherapist[];
	total: number;
	page: number;
	perPage: number;
};