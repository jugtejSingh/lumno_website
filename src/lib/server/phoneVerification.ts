import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, clientPhoneVerification } from '$lib/server/db/schema';
import { phoneOtpNumberRatelimit, phoneOtpRatelimit } from '$lib/server/rateLimit';
import { isWhatsAppConfigured, sendWhatsAppTemplate } from '$lib/server/whatsapp';
import { logError } from '$lib/server/log';

// client.phone only ever holds a verified number. A number the client enters waits in
// client_phone_verification until a correct code moves it into client.phone.
//
// Every function here trusts clientId: callers must have established that it belongs to
// the caller (portal session or invite token).

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export type SendCodeResult =
	| { ok: true }
	| {
			ok: false;
			reason:
				| 'no_phone'
				| 'already_verified'
				| 'cooldown'
				| 'rate_limited'
				| 'number_rate_limited'
				| 'not_configured'
				| 'send_failed';
	  };

export type VerifyCodeResult =
	| { ok: true }
	| { ok: false; reason: 'invalid' | 'no_code' | 'expired' | 'locked' }
	| { ok: false; reason: 'wrong'; triesLeft: number };

// Always 6 digits, so a code like 004219 keeps its leading zeros.
export function generateCode(): string {
	return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCode(code: string): string {
	return createHash('sha256').update(code).digest('hex');
}

async function loadPending(clientId: string) {
	const [row] = await db
		.select()
		.from(clientPhoneVerification)
		.where(eq(clientPhoneVerification.clientId, clientId));
	if (!row) {
		return null;
	}
	return row;
}

// The number waiting to be verified, or null.
export async function getPendingPhone(clientId: string): Promise<string | null> {
	const row = await loadPending(clientId);
	if (!row) {
		return null;
	}
	return row.phone;
}

// What the client typed in the phone field, already checked by parsePhone.
// - null: they removed their number. Clears both, which is the WhatsApp opt-out.
// - their current verified number: nothing to verify, so any pending number is dropped.
// - anything else: becomes the pending number. client.phone is left alone, so their
//   old verified number keeps getting reminders until the new one is verified.
export async function savePhone(clientId: string, phone: string | null): Promise<void> {
	if (phone === null) {
		await db.transaction(async (tx) => {
			await tx.update(client).set({ phone: null }).where(eq(client.id, clientId));
			await tx
				.delete(clientPhoneVerification)
				.where(eq(clientPhoneVerification.clientId, clientId));
		});
		return;
	}

	const [current] = await db
		.select({ phone: client.phone })
		.from(client)
		.where(eq(client.id, clientId));
	if (current && current.phone === phone) {
		await db.delete(clientPhoneVerification).where(eq(clientPhoneVerification.clientId, clientId));
		return;
	}

	// Re-saving the same pending number keeps its live code and cooldown.
	const pending = await loadPending(clientId);
	if (pending && pending.phone === phone) {
		return;
	}

	await db
		.insert(clientPhoneVerification)
		.values({ clientId, phone, otpHash: null, otpExpiresAt: null, otpAttempts: 0 })
		.onConflictDoUpdate({
			target: clientPhoneVerification.clientId,
			set: { phone, otpHash: null, otpExpiresAt: null, otpAttempts: 0 }
		});
}

// Sends a code to the pending number.
export async function sendPhoneCode(clientId: string): Promise<SendCodeResult> {
	const pending = await loadPending(clientId);
	if (!pending) {
		// Nothing pending but a verified number: e.g. the invite page's Verify pressed
		// again after a successful verify (savePhone just dropped the matching pending).
		const [current] = await db
			.select({ phone: client.phone })
			.from(client)
			.where(eq(client.id, clientId));
		if (current && current.phone) {
			return { ok: false, reason: 'already_verified' };
		}
		return { ok: false, reason: 'no_phone' };
	}

	// A code was sent less than a minute ago. Its send time is expiry minus the TTL, so
	// no extra column is needed.
	if (pending.otpHash && pending.otpExpiresAt) {
		const sentAt = pending.otpExpiresAt.getTime() - OTP_TTL_MS;
		if (Date.now() - sentAt < RESEND_COOLDOWN_MS) {
			return { ok: false, reason: 'cooldown' };
		}
	}

	// Checked before the rate limit so a missing config doesn't burn the client's sends.
	if (!isWhatsAppConfigured()) {
		return { ok: false, reason: 'not_configured' };
	}

	const { success } = await phoneOtpRatelimit.limit(clientId);
	if (!success) {
		return { ok: false, reason: 'rate_limited' };
	}

	// hashed so raw phone numbers never land in Redis
	const numberLimit = await phoneOtpNumberRatelimit.limit(hashCode(pending.phone));
	if (!numberLimit.success) {
		return { ok: false, reason: 'number_rate_limited' };
	}

	const code = generateCode();
	const otpHash = hashCode(code);
	const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

	// Pinned to the number just loaded: if the client changed it in between, nothing is
	// stored and nothing is sent.
	const [stored] = await db
		.update(clientPhoneVerification)
		.set({ otpHash, otpExpiresAt, otpAttempts: 0 })
		.where(
			and(
				eq(clientPhoneVerification.clientId, clientId),
				eq(clientPhoneVerification.phone, pending.phone)
			)
		)
		.returning({ clientId: clientPhoneVerification.clientId });
	if (!stored) {
		return { ok: false, reason: 'no_phone' };
	}

	try {
		// lumno_otp's body is "OTP Code: {{1}}. This is your OTP code for {{2}}." and its
		// copy-code button takes the code again
		await sendWhatsAppTemplate(pending.phone, 'lumno_otp', 'en_US', [code, 'Lumno'], code);
	} catch (err) {
		logError('phoneVerification.send', err, { clientId });
		// Nobody received this code, so drop it; otherwise the cooldown would block an
		// immediate retry for a code that never arrived.
		await db
			.update(clientPhoneVerification)
			.set({ otpHash: null, otpExpiresAt: null })
			.where(
				and(
					eq(clientPhoneVerification.clientId, clientId),
					eq(clientPhoneVerification.otpHash, otpHash)
				)
			);
		return { ok: false, reason: 'send_failed' };
	}

	return { ok: true };
}

// A correct code moves the pending number into client.phone and deletes the row.
export async function verifyPhoneCode(clientId: string, code: string): Promise<VerifyCodeResult> {
	const trimmed = code.trim();
	if (!/^\d{6}$/.test(trimmed)) {
		return { ok: false, reason: 'invalid' };
	}

	const pending = await loadPending(clientId);
	if (!pending || !pending.otpHash || !pending.otpExpiresAt) {
		return { ok: false, reason: 'no_code' };
	}
	if (pending.otpExpiresAt.getTime() <= Date.now()) {
		return { ok: false, reason: 'expired' };
	}
	if (pending.otpAttempts >= MAX_ATTEMPTS) {
		return { ok: false, reason: 'locked' };
	}

	// Count the attempt atomically before comparing, so parallel requests can't get
	// more than MAX_ATTEMPTS guesses at one code. Matching on otpHash pins it to the
	// code just checked; a resend or number change in between makes this a no-op.
	const [counted] = await db
		.update(clientPhoneVerification)
		.set({ otpAttempts: sql`${clientPhoneVerification.otpAttempts} + 1` })
		.where(
			and(
				eq(clientPhoneVerification.clientId, clientId),
				eq(clientPhoneVerification.otpHash, pending.otpHash),
				lt(clientPhoneVerification.otpAttempts, MAX_ATTEMPTS)
			)
		)
		.returning({ otpAttempts: clientPhoneVerification.otpAttempts });
	if (!counted) {
		return { ok: false, reason: 'locked' };
	}

	const given = Buffer.from(hashCode(trimmed), 'hex');
	const expected = Buffer.from(pending.otpHash, 'hex');
	if (!timingSafeEqual(given, expected)) {
		return { ok: false, reason: 'wrong', triesLeft: MAX_ATTEMPTS - counted.otpAttempts };
	}

	const otpHash = pending.otpHash;
	const moved = await db.transaction(async (tx) => {
		// Deleting by hash means a resend or number change since the check wins: then
		// nothing is deleted and client.phone isn't touched.
		const [deleted] = await tx
			.delete(clientPhoneVerification)
			.where(
				and(
					eq(clientPhoneVerification.clientId, clientId),
					eq(clientPhoneVerification.otpHash, otpHash)
				)
			)
			.returning({ phone: clientPhoneVerification.phone });
		if (!deleted) {
			return false;
		}
		await tx.update(client).set({ phone: deleted.phone }).where(eq(client.id, clientId));
		return true;
	});
	if (!moved) {
		return { ok: false, reason: 'no_code' };
	}

	return { ok: true };
}
