// Pure calculations for the cancellation/reschedule policy — no DB, no framework imports,
// independent of everything that depends on it (booking, cancel, reschedule).

// 'automatic' = collect session payments in-portal via Razorpay Route; 'manual' =
// therapist marks rows paid by hand. Only meaningful alongside a linked Razorpay
// account — see paymentSettings.ts / the portal's payNow action.
export type PaymentMode = 'manual' | 'automatic';

export type PaymentSettings = {
	paymentMode: PaymentMode;
	// hours of notice before a session's start required to cancel for free
	freeChangeWindowHours: number;
	// hours of notice for the 50% tier; null = no partial tier, straight from free to 100%
	partialChangeWindowHours: number | null;
	// reschedule has its own independent policy, same tier system, own windows
	rescheduleChargesEnabled: boolean;
	rescheduleFreeChangeWindowHours: number;
	reschedulePartialChangeWindowHours: number | null;
};

export type ChangeTier = 'free' | 'partial' | 'full';

// The two fields resolveChangeTier actually needs — PaymentSettings satisfies this
// structurally for cancellation, and a reschedule-specific windows object does too.
export type ChangeWindows = {
	freeChangeWindowHours: number;
	partialChangeWindowHours: number | null;
};

export function hoursNotice(startAt: Date, now: Date): number {
	return (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
}

export function resolveChangeTier(notice: number, windows: ChangeWindows): ChangeTier {
	if (notice >= windows.freeChangeWindowHours) {
		return 'free';
	}
	if (windows.partialChangeWindowHours !== null && notice >= windows.partialChangeWindowHours) {
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

// Reschedule has its own on/off switch plus its own windows — same tier math,
// independent settings from cancellation.
export function resolveReschedulePolicyOutcome(
	startAt: Date,
	settings: PaymentSettings,
	baseAmount: number,
	now: Date = new Date()
): PolicyOutcome {
	if (!settings.rescheduleChargesEnabled) {
		return { tier: 'free', feeAmount: 0 };
	}
	const tier = resolveChangeTier(hoursNotice(startAt, now), {
		freeChangeWindowHours: settings.rescheduleFreeChangeWindowHours,
		partialChangeWindowHours: settings.reschedulePartialChangeWindowHours
	});
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
	const free = `Free to cancel more than ${formatHours(settings.freeChangeWindowHours)} before your session.`;
	if (settings.partialChangeWindowHours === null) {
		return `${free} Within ${formatHours(settings.freeChangeWindowHours)} (or after it's started), a 100% fee applies.`;
	}
	const partial = `Within ${formatHours(settings.freeChangeWindowHours)}, a 50% fee applies.`;
	const full = `Within ${formatHours(settings.partialChangeWindowHours)} (or after it's started), a 100% fee applies.`;
	return `${free} ${partial} ${full}`;
}

export function formatReschedulePolicy(settings: PaymentSettings): string {
	if (!settings.rescheduleChargesEnabled) {
		return 'Rescheduling is always free.';
	}
	const free = `Free to reschedule more than ${formatHours(settings.rescheduleFreeChangeWindowHours)} before your session.`;
	if (settings.reschedulePartialChangeWindowHours === null) {
		return `${free} Within ${formatHours(settings.rescheduleFreeChangeWindowHours)} (or after it's started), a 100% fee applies.`;
	}
	const partial = `Within ${formatHours(settings.rescheduleFreeChangeWindowHours)}, a 50% fee applies.`;
	const full = `Within ${formatHours(settings.reschedulePartialChangeWindowHours)} (or after it's started), a 100% fee applies.`;
	return `${free} ${partial} ${full}`;
}

// Standard set of notice windows offered in the settings UI dropdown, shortest to longest.
export const CHANGE_WINDOW_HOURS_OPTIONS = [0, 1, 2, 4, 8, 12, 24, 48, 72, 168];

export function formatHours(hours: number): string {
	if (hours === 0) {
		return '0 hours';
	}
	if (hours % 24 === 0) {
		const days = hours / 24;
		return days === 1 ? '1 day' : `${days} days`;
	}
	return hours === 1 ? '1 hour' : `${hours} hours`;
}