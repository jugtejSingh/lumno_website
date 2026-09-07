import { eq } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { paymentSettings } from '$lib/server/db/schema';
import type { PaymentSettings, PackExhaustedAction } from '$lib/server/paymentPolicy';

export type { PaymentSettings, PaymentMode, PackExhaustedAction, ChangeTier, PolicyOutcome } from '$lib/server/paymentPolicy';

// The pack + cancellation-policy form. paymentMode is a separate control with its
// own setter, so it is deliberately not in here — this update never touches it.
type PackPolicySettings = {
	packsEnabled: boolean;
	packExhaustedAction: PackExhaustedAction;
	freeChangeWindowHours: number;
	partialChangeWindowHours: number | null;
};

export async function getPaymentSettings(therapistId: string): Promise<PaymentSettings> {
	const [row] = await db
		.select({
			packsEnabled: paymentSettings.packsEnabled,
			paymentMode: paymentSettings.paymentMode,
			packExhaustedAction: paymentSettings.packExhaustedAction,
			freeChangeWindowHours: paymentSettings.freeChangeWindowHours,
			partialChangeWindowHours: paymentSettings.partialChangeWindowHours
		})
		.from(paymentSettings)
		.where(eq(paymentSettings.therapistId, therapistId));
	// ponytail: row seeded at therapist creation (therapistProfile.ts), always present
	return row!;
}

export async function updatePaymentSettings(
	therapistId: string,
	input: PackPolicySettings,
	executor: DbOrTx = db
) {
	if (input.partialChangeWindowHours !== null && input.partialChangeWindowHours >= input.freeChangeWindowHours) {
		throw new Error('partialChangeWindowHours must be less than freeChangeWindowHours');
	}
	await executor.update(paymentSettings).set(input).where(eq(paymentSettings.therapistId, therapistId));
}