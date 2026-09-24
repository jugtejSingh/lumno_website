// A garbage ?month= (missing, non-numeric, or out of 0-11 range) must fall
// back to the current month instead of becoming NaN and silently breaking
// every date computation downstream.
export function parseMonthParam(raw: string | null, now: Date): number {
	if (raw === null) {
		return now.getMonth();
	}
	const value = Number(raw);
	if (Number.isInteger(value) && value >= 0 && value <= 11) {
		return value;
	}
	return now.getMonth();
}
