// Pure calculations for the cancellation/reschedule policy — no DB, no framework imports,
// independent of everything that depends on it (booking, cancel, reschedule).

export type PackExhaustedAction = 'block_booking' | 'require_single_payment';

export type PaymentSettings = {
	packsEnabled: boolean;
	packExhaustedAction: PackExhaustedAction;
	// hours of notice before a session's start required to cancel/reschedule for free
	freeChangeWindowHours: number;
	// hours of notice for the 50% tier; null = no partial tier, straight from free to 100%
	partialChangeWindowHours: number | null;
};

export type ChangeTier = 'free' | 'partial' | 'full';

export function hoursNotice(startAt: Date, now: Date): number {
	return (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
}

export function resolveChangeTier(notice: number, settings: PaymentSettings): ChangeTier {
	if (notice >= settings.freeChangeWindowHours) {
		return 'free';
	}
	if (settings.partialChangeWindowHours !== null && notice >= settings.partialChangeWindowHours) {
		return 'partial';
	}
	return 'full';
}

// fraction of the base session amount owed at each tier — fixed, not a per-therapist setting
export function tierFraction(tier: ChangeTier): number {
	if (tier === 'free') {
		return 0;
	}
	if (tier === 'partial') {
		return 0.5;
	}
	return 1;
}

export type PolicyOutcome = {
	tier: ChangeTier;
	feeAmount: number; // whole currency units, rounded
};

export function resolvePolicyOutcome(
	startAt: Date,
	settings: PaymentSettings,
	baseAmount: number,
	now: Date = new Date()
): PolicyOutcome {
	const tier = resolveChangeTier(hoursNotice(startAt, now), settings);
	return { tier, feeAmount: Math.round(baseAmount * tierFraction(tier)) };
}

// Default note stamped on the auto-created fee row at the moment of cancel/reschedule —
// same as `amount` defaulting to client.rate at booking time, it's just a starting point.
// The therapist can edit or replace this note (and the amount, and delete the row) after
// the fact, same as any other payment row — this isn't a locked/system-owned value.
export function feeNote(kind: 'cancellation' | 'reschedule', tier: ChangeTier): string {
	const percent = tier === 'partial' ? '50%' : '100%';
	return `Late ${kind} fee (${percent})`;
}

export function formatCancellationPolicy(settings: PaymentSettings): string {
	const free = `Free to cancel or reschedule up to ${formatHours(settings.freeChangeWindowHours)} before your session.`;
	if (settings.partialChangeWindowHours === null) {
		return `${free} After that, a 100% fee applies.`;
	}
	const partial = `Between ${formatHours(settings.partialChangeWindowHours)} and ${formatHours(settings.freeChangeWindowHours)} of notice, a 50% fee applies.`;
	const full = `Inside ${formatHours(settings.partialChangeWindowHours)} of your session (or after it's started), a 100% fee applies.`;
	return `${free} ${partial} ${full}`;
}

// Standard set of notice windows offered in the settings UI dropdown, shortest to longest.
export const CHANGE_WINDOW_HOURS_OPTIONS = [1, 2, 4, 8, 12, 24, 48, 72, 168];

export function formatHours(hours: number): string {
	if (hours % 24 === 0) {
		const days = hours / 24;
		return days === 1 ? '1 day' : `${days} days`;
	}
	return hours === 1 ? '1 hour' : `${hours} hours`;
}