import { describe, it, expect } from 'vitest';
import {
	hoursNotice,
	resolveChangeTier,
	tierFraction,
	resolvePolicyOutcome,
	resolveReschedulePolicyOutcome,
	feeNote,
	formatHours,
	formatCancellationPolicy,
	formatReschedulePolicy,
	type PaymentSettings
} from '../../src/lib/server/paymentPolicy';

const threeTier: PaymentSettings = {
	paymentMode: 'manual',
	freeChangeWindowHours: 24,
	partialChangeWindowHours: 8,
	rescheduleChargesEnabled: true,
	rescheduleFreeChangeWindowHours: 24,
	reschedulePartialChangeWindowHours: 8
};
const twoTier: PaymentSettings = { ...threeTier, partialChangeWindowHours: null };

describe('hoursNotice', () => {
	it('is the gap between now and start in hours', () => {
		const now = new Date('2026-09-01T00:00:00Z');
		expect(hoursNotice(new Date('2026-09-01T10:00:00Z'), now)).toBe(10);
		expect(hoursNotice(new Date('2026-08-31T22:00:00Z'), now)).toBe(-2);
	});
});

describe('resolveChangeTier', () => {
	it('picks the tier by notice against the windows', () => {
		expect(resolveChangeTier(30, threeTier)).toBe('free');
		expect(resolveChangeTier(24, threeTier)).toBe('free');
		expect(resolveChangeTier(12, threeTier)).toBe('partial');
		expect(resolveChangeTier(8, threeTier)).toBe('partial');
		expect(resolveChangeTier(4, threeTier)).toBe('full');
	});

	it('goes straight free -> full when there is no partial window', () => {
		expect(resolveChangeTier(30, twoTier)).toBe('free');
		expect(resolveChangeTier(12, twoTier)).toBe('full');
	});
});

describe('tierFraction', () => {
	it('maps tiers to owed fractions', () => {
		expect(tierFraction('free')).toBe(0);
		expect(tierFraction('partial')).toBe(0.5);
		expect(tierFraction('full')).toBe(1);
	});
});

describe('resolvePolicyOutcome', () => {
	const now = new Date('2026-09-01T00:00:00Z');

	it('computes a rounded fee for the resolved tier', () => {
		expect(resolvePolicyOutcome(new Date('2026-09-02T06:00:00Z'), threeTier, 1500, now)).toEqual({
			tier: 'free',
			feeAmount: 0
		});
		expect(resolvePolicyOutcome(new Date('2026-09-01T12:00:00Z'), threeTier, 1500, now)).toEqual({
			tier: 'partial',
			feeAmount: 750
		});
		expect(resolvePolicyOutcome(new Date('2026-09-01T04:00:00Z'), threeTier, 1500, now)).toEqual({
			tier: 'full',
			feeAmount: 1500
		});
	});

	it('rounds a half unit up', () => {
		// 999 * 0.5 = 499.5 -> 500
		expect(
			resolvePolicyOutcome(new Date('2026-09-01T12:00:00Z'), threeTier, 999, now).feeAmount
		).toBe(500);
	});
});

describe('resolveReschedulePolicyOutcome', () => {
	const now = new Date('2026-09-01T00:00:00Z');

	it('always returns free when reschedule charges are disabled, regardless of notice', () => {
		const disabled = { ...threeTier, rescheduleChargesEnabled: false };
		expect(resolveReschedulePolicyOutcome(new Date('2026-09-01T00:30:00Z'), disabled, 1500, now)).toEqual({
			tier: 'free',
			feeAmount: 0
		});
	});

	it('uses its own windows, independent of the cancellation windows', () => {
		const settings = {
			...threeTier,
			freeChangeWindowHours: 24,
			partialChangeWindowHours: 8,
			rescheduleFreeChangeWindowHours: 2,
			reschedulePartialChangeWindowHours: 1
		};
		// 4 hours notice: past the cancellation free window (24h) but past the
		// reschedule free window (2h) too, so reschedule is free while cancel wouldn't be
		expect(resolveReschedulePolicyOutcome(new Date('2026-09-01T04:00:00Z'), settings, 1500, now)).toEqual({
			tier: 'free',
			feeAmount: 0
		});
		expect(resolvePolicyOutcome(new Date('2026-09-01T04:00:00Z'), settings, 1500, now).tier).toBe('full');
	});
});

describe('feeNote', () => {
	it('names the kind and percent', () => {
		expect(feeNote('cancellation', 'partial')).toBe('Late cancellation fee (50%)');
		expect(feeNote('reschedule', 'full')).toBe('Late reschedule fee (100%)');
	});
});

describe('formatHours', () => {
	it('renders hours and whole days', () => {
		expect(formatHours(1)).toBe('1 hour');
		expect(formatHours(2)).toBe('2 hours');
		expect(formatHours(24)).toBe('1 day');
		expect(formatHours(48)).toBe('2 days');
		expect(formatHours(168)).toBe('7 days');
	});
});

describe('formatCancellationPolicy', () => {
	it('mentions the 50% tier only when a partial window exists', () => {
		expect(formatCancellationPolicy(twoTier)).not.toContain('50%');
		expect(formatCancellationPolicy(twoTier)).toContain('100% fee');
		expect(formatCancellationPolicy(threeTier)).toContain('50% fee');
	});
});

describe('formatReschedulePolicy', () => {
	it('says rescheduling is always free when charges are disabled', () => {
		const disabled = { ...threeTier, rescheduleChargesEnabled: false };
		expect(formatReschedulePolicy(disabled)).toBe('Rescheduling is always free.');
	});

	it('mentions the 50% tier only when a partial reschedule window exists', () => {
		const noPartial = { ...threeTier, reschedulePartialChangeWindowHours: null };
		expect(formatReschedulePolicy(noPartial)).not.toContain('50%');
		expect(formatReschedulePolicy(noPartial)).toContain('100% fee');
		expect(formatReschedulePolicy(threeTier)).toContain('50% fee');
	});
});
