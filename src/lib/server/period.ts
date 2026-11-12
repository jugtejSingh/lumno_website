import { zonedDateToUTC, getZonedDateParts } from '$lib/server/timezone';

// The /payments period switch. `?period=` is one of:
//   30d            last 30 days, no end (prepaid future sessions count as paid)
//   month:2026-11  a calendar month in the therapist's timezone
//   365d           last 365 days, no end
//   year:2026      a calendar year in the therapist's timezone
// Anything invalid, or a month/year in the future, falls back to 30d.

export type PeriodKind = '30d' | 'month' | '365d' | 'year';

export type Period = {
	kind: PeriodKind;
	value: string;
	start: Date;
	end: Date | null;
	label: string;
	prev?: string;
	next?: string;
};

export type PeriodOption = { kind: PeriodKind; value: string; label: string };

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

function monthValue(year: number, month: number): string {
	return `month:${year}-${String(month + 1).padStart(2, '0')}`;
}

function yearValue(year: number): string {
	return `year:${year}`;
}

function rollingPeriod(kind: '30d' | '365d', days: number, now: Date): Period {
	let label = 'Last 30 days';
	if (kind === '365d') {
		label = 'Last 365 days';
	}
	return { kind, value: kind, start: new Date(now.getTime() - days * DAY_MS), end: null, label };
}

function monthPeriod(year: number, month: number, timezone: string, now: Date): Period {
	const today = getZonedDateParts(now, timezone);
	const period: Period = {
		kind: 'month',
		value: monthValue(year, month),
		start: zonedDateToUTC(year, month, 1, 0, 0, timezone),
		end: zonedDateToUTC(year, month + 1, 1, 0, 0, timezone),
		label: `${MONTH_NAMES[month]} ${year}`
	};

	let prevYear = year;
	let prevMonth = month - 1;
	if (prevMonth < 0) {
		prevMonth = 11;
		prevYear = year - 1;
	}
	period.prev = monthValue(prevYear, prevMonth);

	const isCurrentMonth = year === today.year && month === today.month;
	if (!isCurrentMonth) {
		let nextYear = year;
		let nextMonth = month + 1;
		if (nextMonth > 11) {
			nextMonth = 0;
			nextYear = year + 1;
		}
		period.next = monthValue(nextYear, nextMonth);
	}
	return period;
}

function yearPeriod(year: number, timezone: string, now: Date): Period {
	const today = getZonedDateParts(now, timezone);
	const period: Period = {
		kind: 'year',
		value: yearValue(year),
		start: zonedDateToUTC(year, 0, 1, 0, 0, timezone),
		end: zonedDateToUTC(year + 1, 0, 1, 0, 0, timezone),
		label: String(year),
		prev: yearValue(year - 1)
	};
	if (year !== today.year) {
		period.next = yearValue(year + 1);
	}
	return period;
}

export function parsePeriod(raw: string | null, timezone: string, now: Date): Period {
	const today = getZonedDateParts(now, timezone);

	if (raw === '365d') {
		return rollingPeriod('365d', 365, now);
	}

	const monthMatch = /^month:(\d{4})-(\d{2})$/.exec(raw ?? '');
	if (monthMatch) {
		const year = Number(monthMatch[1]);
		const month = Number(monthMatch[2]) - 1;
		const validMonth = month >= 0 && month <= 11;
		const notFuture = year < today.year || (year === today.year && month <= today.month);
		if (validMonth && notFuture) {
			return monthPeriod(year, month, timezone, now);
		}
	}

	const yearMatch = /^year:(\d{4})$/.exec(raw ?? '');
	if (yearMatch) {
		const year = Number(yearMatch[1]);
		if (year <= today.year) {
			return yearPeriod(year, timezone, now);
		}
	}

	return rollingPeriod('30d', 30, now);
}

/** The four switch options; Monthly and Yearly open on the current month and year. */
export function periodOptions(timezone: string, now: Date): PeriodOption[] {
	const today = getZonedDateParts(now, timezone);
	return [
		{ kind: '30d', value: '30d', label: 'Last 30 days' },
		{ kind: '365d', value: '365d', label: 'Last 365 days' },
		{ kind: 'month', value: monthValue(today.year, today.month), label: 'Monthly' },
		{ kind: 'year', value: yearValue(today.year), label: 'Yearly' }
	];
}
