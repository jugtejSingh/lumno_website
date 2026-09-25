export type DashboardStat = {
	label: string;
	value: string;
	accent: 'plum' | 'coral' | 'citrus' | 'sage';
	delta?: string;
};

export type UpcomingSession = {
	id: string;
	name: string;
	next: string;
	status: string;
	tone: 'success';
	notesHref: string;
};