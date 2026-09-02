// month grid, padded with leading/trailing nulls so it lines up on 7 columns, chunked into weeks
export function getMonthGridWeeks(year: number, month: number): (number | null)[][] {
	const firstWeekday = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	const days: (number | null)[] = [];
	for (let i = 0; i < firstWeekday; i++) days.push(null);
	for (let d = 1; d <= daysInMonth; d++) days.push(d);
	while (days.length % 7 !== 0) days.push(null);

	const weeks: (number | null)[][] = [];
	for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
	return weeks;
}