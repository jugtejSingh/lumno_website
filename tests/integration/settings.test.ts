import { describe, it, expect, beforeEach } from 'vitest';
import { getNotificationSettings, updateNotificationSettings } from '$lib/server/settings';
import {
	getPaymentSettings,
	updatePaymentSettings,
	getManualPayDetails,
	updateManualPayDetails
} from '$lib/server/paymentSettings';
import { resetDb, mkTherapist } from './helpers';

let therapistId: string;

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist()).id;
});

describe('notification settings', () => {
	it('upserts onto the same therapist_settings row', async () => {
		await updateNotificationSettings(therapistId, {
			sendMeetLinks: false,
			sendBookingEmails: false,
			sendSessionReminderEmails: false,
			sendPaymentReminderEmails: false
		});
		expect(await getNotificationSettings(therapistId)).toEqual({
			sendMeetLinks: false,
			sendBookingEmails: false,
			sendSessionReminderEmails: false,
			sendPaymentReminderEmails: false
		});
	});
});

describe('payment settings', () => {
	it('returns the seeded defaults', async () => {
		expect(await getPaymentSettings(therapistId)).toEqual({
			packsEnabled: false,
			paymentMode: 'manual',
			packExhaustedAction: 'require_single_payment',
			freeChangeWindowHours: 24,
			partialChangeWindowHours: 8
		});
	});

	it('rejects a partial window that is not shorter than the free window', async () => {
		await expect(
			updatePaymentSettings(therapistId, {
				freeChangeWindowHours: 12,
				partialChangeWindowHours: 24
			})
		).rejects.toThrow();
	});

	it('saves a valid update', async () => {
		await updatePaymentSettings(therapistId, {
			freeChangeWindowHours: 48,
			partialChangeWindowHours: 12
		});
		expect(await getPaymentSettings(therapistId)).toMatchObject({
			freeChangeWindowHours: 48,
			partialChangeWindowHours: 12
		});
	});
});

describe('manual pay details', () => {
	it('starts empty, round-trips, and clears', async () => {
		expect(await getManualPayDetails(therapistId)).toEqual({ qrKey: null, bankDetails: null });

		await updateManualPayDetails(therapistId, {
			qrKey: `upi/${therapistId}/abc`,
			bankDetails: 'UPI: someone@upi'
		});
		expect(await getManualPayDetails(therapistId)).toEqual({
			qrKey: `upi/${therapistId}/abc`,
			bankDetails: 'UPI: someone@upi'
		});

		await updateManualPayDetails(therapistId, { qrKey: null, bankDetails: null });
		expect(await getManualPayDetails(therapistId)).toEqual({ qrKey: null, bankDetails: null });
	});
});
