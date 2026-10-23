export function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
		maximumFractionDigits: 0
	}).format(amount);
}

// "Fri, Oct 23, 10:00 AM"
export function formatWhen(at: Date, timezone: string): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(at);
}

// "1st", "2nd", "3rd", "11th", "22nd"...
export function ordinal(day: number): string {
	const lastTwo = day % 100;
	if (lastTwo >= 11 && lastTwo <= 13) {
		return `${day}th`;
	}
	const last = day % 10;
	if (last === 1) {
		return `${day}st`;
	}
	if (last === 2) {
		return `${day}nd`;
	}
	if (last === 3) {
		return `${day}rd`;
	}
	return `${day}th`;
}

// "10:00 AM". Newer ICU puts a narrow no-break space before AM/PM; a plain space reads
// the same everywhere.
export function formatTime(at: Date, timezone: string): string {
	const text = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	}).format(at);
	const narrowNoBreakSpace = String.fromCharCode(0x202f);
	return text.replaceAll(narrowNoBreakSpace, ' ');
}
// Full name of the timezone at that moment, e.g. "India Standard Time" or "Eastern
// Daylight Time" (so it follows daylight saving).
export function timeZoneName(at: Date, timezone: string): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		timeZoneName: 'long'
	}).formatToParts(at);
	for (const part of parts) {
		if (part.type === 'timeZoneName') {
			return part.value;
		}
	}
	return timezone;
}

// formatWhen plus the timezone's name, e.g. "Fri, Oct 23, 10:00 AM (India Standard Time)".
// What client-facing emails show.
export function formatWhenWithZone(at: Date, timezone: string): string {
	return `${formatWhen(at, timezone)} (${timeZoneName(at, timezone)})`;
}
