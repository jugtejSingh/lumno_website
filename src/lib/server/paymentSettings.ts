import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { paymentSettings } from '$lib/server/db/schema';
import type { PaymentSettings } from '$lib/server/paymentPolicy';

export type { PaymentSettings, PackExhaustedAction, ChangeTier, PolicyOutcome } from '$lib/server/paymentPolicy';

const defaults: PaymentSettings = {
	packsEnabled: false,
	packExhaustedAction: 'require_single_payment',
	freeChangeWindowHours: 24,
	partialChangeWindowHours: 8
};

export async function getPaymentSettings(therapistId: string): Promise<PaymentSettings> {
	const [row] = await db
		.select({
			packsEnabled: paymentSettings.packsEnabled,
			packExhaustedAction: paymentSettings.packExhaustedAction,
			freeChangeWindowHours: paymentSettings.freeChangeWindowHours,
			partialChangeWindowHours: paymentSettings.partialChangeWindowHours
		})
		.from(paymentSettings)
		.where(eq(paymentSettings.therapistId, therapistId));
	return row ?? defaults;
}

export async function updatePaymentSettings(therapistId: string, input: PaymentSettings) {
	if (input.partialChangeWindowHours !== null && input.partialChangeWindowHours >= input.freeChangeWindowHours) {
		throw new Error('partialChangeWindowHours must be less than freeChangeWindowHours');
	}
	await db
		.insert(paymentSettings)
		.values({ therapistId, ...input })
		.onConflictDoUpdate({ target: paymentSettings.therapistId, set: input });
}