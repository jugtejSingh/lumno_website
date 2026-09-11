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
import {
	getPaymentSettings,
	updatePaymentSettings,
	getManualPayDetails,
	updateManualPayDetails
} from '$lib/server/paymentSettings';
import { putObject, deleteObject, signedUrl } from '$lib/server/storage';
import { randomUUID } from 'node:crypto';
import { connectionHealth } from '$lib/server/razorpayConnection';
import { isGoogleCalendarConnected } from '$lib/server/googleCalendar';
import { CHANGE_WINDOW_HOURS_OPTIONS, formatHours } from '$lib/server/paymentPolicy';
import { describeAuthError, describeOAuthError } from '$lib/server/authErrors';
import { logError } from '$lib/server/log';

const FORMATS = ['remote', 'in_person', 'hybrid'] as const;
const SCHEDULE_KINDS: ScheduleKind[] = ['online', 'in_person', 'off'];
const MAX_QR_BYTES = 5 * 1024 * 1024;

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { therapist } = await parent();
	const therapistId = locals.therapistId!;

	const [
		profile,
		schedule,
		notifications,
		payments,
		subscription,
		googleConnected,
		razorpayHealth,
		manualPayRow
	] = await Promise.all([
		getReferralProfile(therapistId),
		getTherapistScheduleSettings(therapistId),
		getNotificationSettings(therapistId),
		getPaymentSettings(therapistId),
		// Raw plan/status, not getEffectivePlan — a past_due row intentionally keeps
		// its plan number so the card can show "Pro — payment failed" instead of
		// silently reading as Free. See the webhook handler's plan-retention comment.
		getOrCreateSubscription(therapistId),
		isGoogleCalendarConnected(therapist.userId),
		connectionHealth(therapistId),
		getManualPayDetails(therapistId)
	]);

	let qrUrl: string | null = null;
	if (manualPayRow.qrKey) {
		qrUrl = await signedUrl(manualPayRow.qrKey);
	}
	const manualPay = {
		qrUrl,
		bankDetails: manualPayRow.bankDetails ?? ''
	};

	const billing = {
		plan: subscription.plan,
		status: subscription.status,
		cancelScheduled: subscription.cancelScheduled
	};

	const hourOptions = CHANGE_WINDOW_HOURS_OPTIONS.map((hours) => ({
		hours,
		label: formatHours(hours)
	}));

	const razorpay = {
		health: razorpayHealth,
		currencySupported: therapist.currency === 'INR',
		notice: url.searchParams.get('payments')
	};

	const calendarError = describeOAuthError(
		'settings.googleCalendar.callback',
		url,
		'Google Calendar could not be connected. Please try again.',
		{ therapistId }
	);

	return {
		profile,
		schedule,
		notifications,
		payments,
		manualPay,
		billing,
		googleConnected,
		hourOptions,
		razorpay,
		calendarError
	};
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

		// ---- payments (cancellation policy) ----
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
				message:
					'Partial change window must be a non-negative number of hours, shorter than the free window'
			});
		}
		const payments = {
			freeChangeWindowHours,
			partialChangeWindowHours
		};

		// ---- manual payment details (QR image + bank text) ----
		const bankDetails = form.get('payBankDetails')?.toString().trim() || null;
		const removeQr = form.get('removePayQr') === 'on';
		const qrFile = form.get('payQrImage');
		let newQrFile: File | null = null;
		if (qrFile instanceof File && qrFile.size > 0) {
			if (!qrFile.type.startsWith('image/')) {
				return fail(400, { message: 'The QR code must be an image file' });
			}
			if (qrFile.size > MAX_QR_BYTES) {
				return fail(400, { message: 'The QR code image must be under 5 MB' });
			}
			newQrFile = qrFile;
		}

		// Upload before the transaction so a failed upload leaves the DB untouched;
		// the old object is removed only after the new key is committed.
		const current = await getManualPayDetails(therapistId);
		let qrKey = current.qrKey;
		if (newQrFile) {
			qrKey = `upi/${therapistId}/${randomUUID()}`;
			await putObject(qrKey, new Uint8Array(await newQrFile.arrayBuffer()), newQrFile.type);
		} else if (removeQr) {
			qrKey = null;
		}

		await db.transaction(async (tx) => {
			await updateReferralProfile(therapistId, referral, tx);
			await updateTherapistScheduleSettings(therapistId, schedule, tx);
			await updateNotificationSettings(therapistId, notifications, tx);
			await updatePaymentSettings(therapistId, payments, tx);
			await updateManualPayDetails(therapistId, { qrKey, bankDetails }, tx);
		});

		if (current.qrKey && current.qrKey !== qrKey) {
			try {
				await deleteObject(current.qrKey);
			} catch (err) {
				// ponytail: an orphaned object is harmless, just log it
				logError('settings.payQr.delete', err, { therapistId, key: current.qrKey });
			}
		}

		return { saved: true };
	},

	connectGoogleCalendar: async (event) => {
		let url: string | undefined;
		try {
			const result = await auth.api.linkSocialAccount({
				body: {
					provider: 'google',
					callbackURL: '/settings',
					errorCallbackURL: '/settings',
					scopes: ['https://www.googleapis.com/auth/calendar.events']
				},
				headers: event.request.headers
			});
			url = result.url;
		} catch (err) {
			const failure = describeAuthError(
				'settings.googleCalendar.link',
				err,
				'Could not start the Google Calendar connection. Please try again.'
			);
			return fail(failure.status, { message: failure.message });
		}
		if (!url) {
			logError('settings.googleCalendar.link', new Error('linkSocialAccount returned no url'), {
				therapistId: event.locals.therapistId
			});
			return fail(500, { message: 'Could not start the Google Calendar connection. Please try again.' });
		}
		return redirect(302, url);
	}
};
