import type { PageServerLoad } from './$types';
import type { DashboardStat, UpcomingSession } from '$lib/types/dashboard';

export const load: PageServerLoad = async () => {
	const therapistName = 'Dana Reyes';

	const stats: DashboardStat[] = [
		{ label: 'Sessions this week', value: '12', accent: 'plum', delta: '+2 vs last week' },
		{ label: 'New clients', value: '3', accent: 'coral' },
		{ label: 'Notes overdue', value: '1', accent: 'citrus' },
		{ label: 'Outstanding balance', value: '$300', accent: 'sage' }
	];

	const upcoming: UpcomingSession[] = [
		{
			name: 'Maria Chen',
			next: 'Today · 2:00 PM',
			status: 'confirmed',
			tone: 'success',
			notesHref: '/notes?client=Maria+Chen'
		},
		{
			name: 'James Okoro',
			next: 'Tomorrow · 10:00 AM',
			status: 'pending',
			tone: 'warning',
			notesHref: '/notes?client=James+Okoro'
		},
		{
			name: 'Priya Nair',
			next: 'Thu · 9:30 AM',
			status: 'confirmed',
			tone: 'success',
			notesHref: '/notes?client=Priya+Nair'
		},
		{
			name: 'Leo Fischer',
			next: 'Fri · 1:00 PM',
			status: 'confirmed',
			tone: 'success',
			notesHref: '/notes?client=Leo+Fischer'
		}
	];

	return {
		therapistName,
		todayCount: upcoming.filter((s) => s.next.startsWith('Today')).length,
		stats,
		upcoming
	};
};