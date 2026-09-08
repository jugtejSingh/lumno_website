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

// CURRENT_ENVIRONMENT === 'testing' swaps in a parallel _TEST-suffixed key set
// (keys, webhook secret, plan ids). No fallback to live: a missing _TEST var
// must fail loudly, never silently transact against the live account. Anything
// but 'testing' (including unset) = live.
const TESTING = env.CURRENT_ENVIRONMENT === 'testing';

function rzpEnv(name: string): string | undefined {
	if (TESTING) {
		// ponytail: the test key id is named RAZORPAY_KEY_TEST, not RAZORPAY_KEY_ID_TEST.
		if (name === 'RAZORPAY_KEY_ID') {
			return env.RAZORPAY_KEY_TEST;
		}
		return env[`${name}_TEST`];
	}
	return env[name];
}

// The frontend (Razorpay checkout.js) needs the key id — server hands it over.
export function razorpayKeyId(): string {
	const id = rzpEnv('RAZORPAY_KEY_ID');
	if (!id) {
		throw new Error('RAZORPAY_KEY_ID not set');
	}
	return id;
}

let client: Razorpay | undefined;

export function razorpay(): Razorpay {
	if (!client) {
		const keyId = rzpEnv('RAZORPAY_KEY_ID');
		const keySecret = rzpEnv('RAZORPAY_KEY_SECRET');
		if (!keyId || !keySecret) {
			throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set');
		}
		client = new Razorpay({
			key_id: keyId,
			key_secret: keySecret
		});
		// The SDK never sets a request timeout, so a hung connection would wait
		// forever — and a stuck subscriptions.create() would hold the pending-slot
		// dedup indefinitely (see billing.ts). Matches edvion's _TimeoutSession.
		// `rq` (the underlying axios instance) isn't in the SDK's public types.
		(client.api as unknown as { rq: { defaults: { timeout: number } } }).rq.defaults.timeout =
			20_000;
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
	const value = key ? rzpEnv(key) : undefined;
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
		if (rzpEnv(key) === razorpayPlanId) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Partner OAuth — therapists connect their own Razorpay merchant account and we
// act on their behalf with scoped tokens. See docs/razorpay-oauth-system-design.md.
// Same TEST_-prefix rule as the rest of this file: the dev OAuth client is
// test-mode only, the prod client live-mode only.
// ─────────────────────────────────────────────────────────────────────────────

const OAUTH_BASE = 'https://auth.razorpay.com';
// Same reason the SDK client gets a 20s timeout above: a hung token refresh would
// hold the single-flight lease in razorpayConnection.ts for its full 60s.
const FETCH_TIMEOUT_MS = 20_000;

export const RAZORPAY_OAUTH_MODE: 'test' | 'live' = TESTING ? 'test' : 'live';

export function razorpayOAuthConfig(): {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
} {
	const clientId = rzpEnv('RAZORPAY_OAUTH_CLIENT_ID');
	const clientSecret = rzpEnv('RAZORPAY_OAUTH_CLIENT_SECRET');
	const redirectUri = rzpEnv('RAZORPAY_OAUTH_REDIRECT_URI');
	if (!clientId || !clientSecret || !redirectUri) {
		throw new Error(
			'RAZORPAY_OAUTH_CLIENT_ID / RAZORPAY_OAUTH_CLIENT_SECRET / RAZORPAY_OAUTH_REDIRECT_URI not set'
		);
	}
	return { clientId, clientSecret, redirectUri };
}

export interface OAuthTokenResponse {
	access_token: string;
	refresh_token: string;
	public_token: string;
	expires_in: number;
	razorpay_account_id: string;
	scope?: string;
}

// 4xx from the token endpoint means the grant is dead — no retry recovers it.
export class RazorpayOAuthError extends Error {
	readonly status: number;
	constructor(status: number) {
		super(`Razorpay OAuth token endpoint returned ${status}`);
		this.name = 'RazorpayOAuthError';
		this.status = status;
	}
	get isClientError(): boolean {
		return this.status >= 400 && this.status < 500;
	}
}

// Razorpay's token endpoint takes a JSON body (docs: "Content-type:
// application/json"), not the RFC 6749 form encoding. Never log `body` or the
// response — both carry the code / refresh_token / client_secret.
async function oauthTokenRequest(body: Record<string, string>): Promise<OAuthTokenResponse> {
	const res = await fetch(`${OAUTH_BASE}/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) {
		throw new RazorpayOAuthError(res.status);
	}
	return (await res.json()) as OAuthTokenResponse;
}

// The authorisation code arrives URL-encoded in the callback query — decode
// before exchanging or you get an opaque invalid_grant (design doc §3.1).
// redirect_uri must byte-match the one used in the authorize URL.
export function exchangeOAuthCode(code: string): Promise<OAuthTokenResponse> {
	const { clientId, clientSecret, redirectUri } = razorpayOAuthConfig();
	return oauthTokenRequest({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri,
		code: decodeURIComponent(code),
		mode: RAZORPAY_OAUTH_MODE
	});
}

// The refresh token rotates on every use — persist the new pair immediately.
export function refreshOAuthToken(refreshToken: string): Promise<OAuthTokenResponse> {
	const { clientId, clientSecret } = razorpayOAuthConfig();
	return oauthTokenRequest({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'refresh_token',
		refresh_token: refreshToken
	});
}

const API_BASE = 'https://api.razorpay.com/v1';

export interface SubMerchantOrder {
	id: string;
	amount: number;
	currency: string;
	receipt: string;
	status: string;
}

// Create an order ON THE THERAPIST'S account using their OAuth access token. The
// token scopes the request to their account, so there's no X-Razorpay-Account
// header (design doc §5.2, §12.4). amountMinor is integer paise — never a float.
// receipt is our internal payment id, the reconciliation anchor; notes carry the
// same ids so a Razorpay-side dispute is a query, not an afternoon.
export async function createSubMerchantOrder(opts: {
	accessToken: string;
	amountMinor: number;
	receipt: string;
	notes: Record<string, string>;
}): Promise<SubMerchantOrder> {
	const res = await fetch(`${API_BASE}/orders`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${opts.accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			amount: opts.amountMinor,
			currency: 'INR',
			receipt: opts.receipt,
			notes: opts.notes
		}),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) {
		// Don't log the body — it echoes the request, which is fine, but keep the
		// access token out of any error string.
		throw new Error(`Razorpay order create failed: ${res.status}`);
	}
	return (await res.json()) as SubMerchantOrder;
}

export interface SubMerchantOrderStatus {
	id: string;
	status: string; // 'created' | 'attempted' | 'paid'
	amount: number;
	amount_paid: number;
}

// Read an order back from the therapist's account — the reconciliation sweep
// (design doc §7) uses this to resolve orders whose payment.captured webhook
// never arrived.
export async function fetchSubMerchantOrder(
	accessToken: string,
	orderId: string
): Promise<SubMerchantOrderStatus> {
	const res = await fetch(`${API_BASE}/orders/${orderId}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) {
		throw new Error(`Razorpay order fetch failed: ${res.status}`);
	}
	return (await res.json()) as SubMerchantOrderStatus;
}

export interface SubMerchantPayment {
	id: string;
	status: string; // 'captured' | 'authorized' | 'failed' | 'refunded'
	amount: number;
}

export async function fetchSubMerchantOrderPayments(
	accessToken: string,
	orderId: string
): Promise<SubMerchantPayment[]> {
	const res = await fetch(`${API_BASE}/orders/${orderId}/payments`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) {
		throw new Error(`Razorpay order payments fetch failed: ${res.status}`);
	}
	const body = (await res.json()) as { items?: SubMerchantPayment[] };
	return body.items ?? [];
}

// Verify the X-Razorpay-Signature header against the raw request body.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
	const secret = rzpEnv('RAZORPAY_WEBHOOK_SECRET');
	if (!secret || !signature) {
		return false;
	}
	try {
		return validateWebhookSignature(rawBody, signature, secret);
	} catch {
		return false;
	}
}
