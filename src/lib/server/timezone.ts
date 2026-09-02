// Converting UTC -> local is trivial with Intl (it's DST-aware automatically
// when formatting). Converting local -> UTC is the only hard part: the same
// wall-clock time can map to two different UTC instants near a DST
// transition, so we guess, ask Intl what offset actually applied, then
// correct. That's the one non-trivial function below; everything else is a
// thin wrapper around it. Month is 0-indexed everywhere here, matching the
// rest of the codebase's plain `new Date(year, month, day)` convention.

function getOffsetMinutes(date: Date, timeZone: string): number {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone,
			hour12: false,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})
			.formatToParts(date)
			.filter((p) => p.type !== 'literal')
			.map((p) => [p.type, p.value])
	);
	// midnight is sometimes formatted as "24" by this API
	const hour = parts.hour === '24' ? '0' : parts.hour;
	const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
	return (asUTC - date.getTime()) / 60_000;
}

/** UTC instant for a given wall-clock time in `timeZone`. */
export function zonedDateToUTC(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	timeZone: string
): Date {
	const guess = new Date(Date.UTC(year, month, day, hour, minute));
	return new Date(guess.getTime() - getOffsetMinutes(guess, timeZone) * 60_000);
}

/** [start, end) UTC instants spanning local midnight-to-midnight for that calendar day. */
export function zonedDayBounds(year: number, month: number, day: number, timeZone: string) {
	return {
		start: zonedDateToUTC(year, month, day, 0, 0, timeZone),
		end: zonedDateToUTC(year, month, day + 1, 0, 0, timeZone)
	};
}

/** Weekday (0 = Sunday) that a UTC instant falls on in `timeZone`. */
export function getZonedWeekday(date: Date, timeZone: string): number {
	const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
	return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(label);
}

/** {year, month (0-indexed), day} that a UTC instant falls on in `timeZone`. */
export function getZonedDateParts(date: Date, timeZone: string) {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
			.formatToParts(date)
			.filter((p) => p.type !== 'literal')
			.map((p) => [p.type, p.value])
	);
	return { year: +parts.year, month: +parts.month - 1, day: +parts.day };
}

/** Postgres `time` columns come back as "HH:MM:SS" strings. */
export function parseTimeOfDay(time: string): [number, number] {
	const [hour, minute] = time.split(':').map(Number);
	return [hour, minute];
}
