import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { getOrCreateSubscription } from '$lib/server/billing';
import { getReferralProfile, updateReferralProfile } from '$lib/server/referrals';
import {
	getTherapistScheduleSettings,
	updateTherapistScheduleSettings,
	getNotificationSettings,
	updateNotificationSettings,
	type ScheduleKind
} from '$lib/server/settings';
import { getPaymentSettings, updatePaymentSettings } from '$lib/server/paymentSettings';
import { isGoogleCalendarConnected } from '$lib/server/googleCalendar';
import { CHANGE_WINDOW_HOURS_OPTIONS, formatHours } from '$lib/server/paymentPolicy';

const FORMATS = ['remote', 'in_person', 'hybrid'] as const;
const SCHEDULE_KINDS: ScheduleKind[] = ['online', 'in_person', 'off'];
const PACK_EXHAUSTED_ACTIONS = ['block_booking', 'require_single_payment'] as const;

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { therapist } = await parent();
	const therapistId = locals.therapistId!;

	const [profile, schedule, notifications, payments, subscription, googleConnected] = await Promise.all([
		getReferralProfile(therapistId),
		getTherapistScheduleSettings(therapistId),
		getNotificationSettings(therapistId),
		getPaymentSettings(therapistId),
		// Raw plan/status, not getEffectivePlan — a past_due row intentionally keeps
		// its plan number so the card can show "Pro — payment failed" instead of
		// silently reading as Free. See the webhook handler's plan-retention comment.
		getOrCreateSubscription(therapistId),
		isGoogleCalendarConnected(therapist.userId)
	]);

	const billing = {
		plan: subscription.plan,
		status: subscription.status,
		cancelScheduled: subscription.cancelScheduled
	};

	const hourOptions = CHANGE_WINDOW_HOURS_OPTIONS.map((hours) => ({ hours, label: formatHours(hours) }));

	return { profile, schedule, notifications, payments, billing, googleConnected, hourOptions };
};

function parseIntOrNull(value: string): number | null {
	if (!value.trim()) {
		return null;
	}
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 0) {
		return null;
	}
	return n;
}

export const actions: Actions = {
	// One button on the settings page saves every section at once. Parse and
	// validate all four groups first, bail on the first problem, then write them
	// in a single transaction so a partial save is impossible.
	save: async ({ request, locals }) => {
		const therapistId = locals.therapistId!;
		const form = await request.formData();

		// ---- referral profile ----
		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) {
			return fail(400, { message: 'Name is required' });
		}
		const formatRaw = form.get('sessionFormat')?.toString() ?? '';
		let sessionFormat: (typeof FORMATS)[number] | null = null;
		if ((FORMATS as readonly string[]).includes(formatRaw)) {
			sessionFormat = formatRaw as (typeof FORMATS)[number];
		}
		const tags =
			form
				.get('tags')
				?.toString()
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean) ?? [];
		const referral = {
			name,
			bio: form.get('bio')?.toString().trim() ?? '',
			tags,
			location: form.get('location')?.toString().trim() || null,
			sessionFormat,
			yearsExperience: parseIntOrNull(form.get('yearsExperience')?.toString() ?? ''),
			sessionRate: parseIntOrNull(form.get('sessionRate')?.toString() ?? ''),
			referralVisible: form.get('referralVisible') === 'on',
			referralShowYears: form.get('referralShowYears') === 'on',
			referralShowRate: form.get('referralShowRate') === 'on'
		};

		// ---- schedule ----
		const bufferMinutes = Number(form.get('bufferMinutes'));
		const earliestBookingTime = form.get('earliestBookingTime')?.toString() ?? '';
		const latestBookingTime = form.get('latestBookingTime')?.toString() ?? '';
		const weeklySchedule = form.getAll('weeklySchedule').map((v) => v.toString());
		if (!earliestBookingTime || !latestBookingTime) {
			return fail(400, { message: 'Pick both working hours' });
		}
		if (latestBookingTime <= earliestBookingTime) {
			return fail(400, { message: 'Working hours must end after they start' });
		}
		if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
			return fail(400, { message: 'Buffer must be a non-negative number of minutes' });
		}
		if (
			weeklySchedule.length !== 7 ||
			!weeklySchedule.every((k) => SCHEDULE_KINDS.includes(k as ScheduleKind))
		) {
			return fail(400, { message: 'Pick a valid type for every day of the week' });
		}
		const schedule = {
			bufferMinutes,
			earliestBookingTime,
			latestBookingTime,
			weeklySchedule: weeklySchedule as ScheduleKind[]
		};

		// ---- notifications ----
		const notifications = {
			sendMeetLinks: form.get('sendMeetLinks') === 'on',
			sendBookingEmails: form.get('sendBookingEmails') === 'on',
			sendSessionReminderEmails: form.get('sendSessionReminderEmails') === 'on',
			sendPaymentReminderEmails: form.get('sendPaymentReminderEmails') === 'on'
		};

		// ---- payments (pack + cancellation policy) ----
		const packExhaustedActionRaw = form.get('packExhaustedAction')?.toString() ?? '';
		if (!(PACK_EXHAUSTED_ACTIONS as readonly string[]).includes(packExhaustedActionRaw)) {
			return fail(400, { message: 'Pick what happens when a pack runs out' });
		}
		const freeChangeWindowHours = Number(form.get('freeChangeWindowHours'));
		if (!Number.isFinite(freeChangeWindowHours) || freeChangeWindowHours < 0) {
			return fail(400, { message: 'Free change window must be a non-negative number of hours' });
		}
		const partialRaw = form.get('partialChangeWindowHours')?.toString() ?? '';
		const partialChangeWindowHours = partialRaw === '' ? null : Number(partialRaw);
		if (
			partialChangeWindowHours !== null &&
			(!Number.isFinite(partialChangeWindowHours) ||
				partialChangeWindowHours < 0 ||
				partialChangeWindowHours >= freeChangeWindowHours)
		) {
			return fail(400, {
				message: 'Partial change window must be a non-negative number of hours, shorter than the free window'
			});
		}
		const payments = {
			packsEnabled: form.get('packsEnabled') === 'on',
			packExhaustedAction: packExhaustedActionRaw as (typeof PACK_EXHAUSTED_ACTIONS)[number],
			freeChangeWindowHours,
			partialChangeWindowHours
		};

		await db.transaction(async (tx) => {
			await updateReferralProfile(therapistId, referral, tx);
			await updateTherapistScheduleSettings(therapistId, schedule, tx);
			await updateNotificationSettings(therapistId, notifications, tx);
			await updatePaymentSettings(therapistId, payments, tx);
		});

		return { saved: true };
	},

	connectGoogleCalendar: async (event) => {
		let url: string | undefined;
		try {
			const result = await auth.api.linkSocialAccount({
				body: {
					provider: 'google',
					callbackURL: '/settings',
					scopes: ['https://www.googleapis.com/auth/calendar.events']
				},
				headers: event.request.headers
			});
			url = result.url;
		} catch {
			return fail(500, { message: 'Could not start Google Calendar connection' });
		}
		if (!url) {
			return fail(500, { message: 'Could not start Google Calendar connection' });
		}
		return redirect(302, url);
	}
};