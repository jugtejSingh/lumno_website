import Razorpay from 'razorpay';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { env } from '$env/dynamic/private';

// Razorpay client + the plan-number <-> plan-id mapping. See
// docs/billing-and-organizations.md. Organizations are disabled — see
// organizations.ts — so this only ever mints therapist-tier subscriptions.

// Number of billing cycles before Razorpay marks the subscription `completed`.
// Razorpay requires a finite total_count; 120 monthly cycles = 10 years,
// effectively "until cancelled". (edvion bills weekly, hence its 1200 — this is
// the monthly-cycle equivalent, not a divergence.)
// ponytail: bump if a plan is ever billed yearly and someone stays 10+ years.
const TOTAL_COUNT = 120;

let client: Razorpay | undefined;

export function razorpay(): Razorpay {
	if (!client) {
		if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
			throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set');
		}
		client = new Razorpay({
			key_id: env.RAZORPAY_KEY_ID,
			key_secret: env.RAZORPAY_KEY_SECRET
		});
		// The SDK never sets a request timeout, so a hung connection would wait
		// forever — and a stuck subscriptions.create() would hold the pending-slot
		// dedup indefinitely (see billing.ts). Matches edvion's _TimeoutSession.
		// `rq` (the underlying axios instance) isn't in the SDK's public types.
		(client.api as unknown as { rq: { defaults: { timeout: number } } }).rq.defaults.timeout = 20_000;
	}
	return client;
}

// The one mapping: our plan number (billing.ts) <-> the env var holding its
// Razorpay plan id. Checkout goes number -> id (planIdFor); the webhook gets an
// id from Razorpay and goes id -> number (planNumberFor).
const PLAN_ID_ENV: Record<number, string> = {
	1: 'RAZORPAY_PLAN_ID_1',
	2: 'RAZORPAY_PLAN_ID_2'
};

export function planIdFor(planNumber: number): string {
	const key = PLAN_ID_ENV[planNumber];
	const value = key ? env[key] : undefined;
	if (!value) {
		throw new Error(`no Razorpay plan id configured for plan ${planNumber} (${key})`);
	}
	return value;
}

// id -> tier number. Unknown plan_id resolves to 0 (no access), same as edvion's
// PLAN_ID_TO_TIER.get(plan_id, 0) — the webhook just treats it as no entitlement
// rather than throwing.
export function planNumberFor(razorpayPlanId: string): number {
	for (const [planNumber, key] of Object.entries(PLAN_ID_ENV)) {
		if (env[key] === razorpayPlanId) {
			return Number(planNumber);
		}
	}
	return 0;
}

// notes carries { therapistId } so the webhook can resolve the holder.
export async function createSubscription(planNumber: number, notes: { therapistId: string }) {
	return razorpay().subscriptions.create({
		plan_id: planIdFor(planNumber),
		total_count: TOTAL_COUNT,
		customer_notify: 1,
		expire_by: Math.floor(Date.now() / 1000) + 1800,
		notes
	});
}

// Always cancel-at-cycle-end (see design doc — there is no "cancel now").
export async function cancelSubscription(id: string) {
	return razorpay().subscriptions.cancel(id, true);
}

// Verify the X-Razorpay-Signature header against the raw request body.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
	if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) {
		return false;
	}
	try {
		return validateWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
	} catch {
		return false;
	}
}
