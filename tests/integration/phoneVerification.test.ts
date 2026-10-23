import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// Meta and Upstash are replaced: these tests check the DB side of the OTP flow
const { sendWhatsAppTemplate, isWhatsAppConfigured, clientLimit, numberLimit } = vi.hoisted(
	() => ({
		sendWhatsAppTemplate: vi.fn(async () => {}),
		isWhatsAppConfigured: vi.fn(() => true),
		clientLimit: vi.fn(async () => ({ success: true })),
		numberLimit: vi.fn(async () => ({ success: true }))
	})
);
vi.mock('$lib/server/whatsapp', () => ({ sendWhatsAppTemplate, isWhatsAppConfigured }));
vi.mock('$lib/server/rateLimit', () => ({
	phoneOtpRatelimit: { limit: clientLimit },
	phoneOtpNumberRatelimit: { limit: numberLimit }
}));
vi.mock('$lib/server/log', () => ({ logError: vi.fn() }));

const { db } = await import('$lib/server/db');
const { client, clientPhoneVerification } = await import('$lib/server/db/schema');
const { generateCode, hashCode, savePhone, sendPhoneCode, verifyPhoneCode, getPendingPhone } =
	await import('$lib/server/phoneVerification');
const { resetDb, mkTherapist, mkClient } = await import('./helpers');

const PHONE = '+919876543210';
const OTHER_PHONE = '+919812345678';

let clientId: string;

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	const t = await mkTherapist();
	clientId = (await mkClient(t.id)).id;
});

async function loadRow() {
	const [row] = await db
		.select()
		.from(clientPhoneVerification)
		.where(eq(clientPhoneVerification.clientId, clientId));
	return row;
}

async function loadClientPhone() {
	const [row] = await db.select({ phone: client.phone }).from(client).where(eq(client.id, clientId));
	return row.phone;
}

// The code that was sent to Meta in the most recent sendWhatsAppTemplate call
function lastSentCode(): string {
	const calls = sendWhatsAppTemplate.mock.calls as unknown as unknown[][];
	const lastCall = calls[calls.length - 1];
	return lastCall[4] as string;
}

// Moves the stored code's send time back so the 60s resend cooldown has passed
async function pastCooldown() {
	await db
		.update(clientPhoneVerification)
		.set({ otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000) })
		.where(eq(clientPhoneVerification.clientId, clientId));
}

async function savedAndSent(): Promise<string> {
	await savePhone(clientId, PHONE);
	const result = await sendPhoneCode(clientId);
	expect(result).toEqual({ ok: true });
	return lastSentCode();
}

describe('generateCode / hashCode', () => {
	it('always gives 6 digits, keeping leading zeros', () => {
		for (let i = 0; i < 500; i++) {
			expect(generateCode()).toMatch(/^\d{6}$/);
		}
	});

	it('hashes the same code to the same value', () => {
		expect(hashCode('004219')).toBe(hashCode('004219'));
		expect(hashCode('004219')).not.toBe(hashCode('4219'));
	});
});

describe('savePhone', () => {
	it('keeps a new number pending and leaves client.phone alone', async () => {
		await savePhone(clientId, PHONE);
		expect(await getPendingPhone(clientId)).toBe(PHONE);
		expect(await loadClientPhone()).toBeNull();
	});

	it('re-saving the verified number drops the pending row and keeps verification', async () => {
		await db.update(client).set({ phone: PHONE }).where(eq(client.id, clientId));
		await savePhone(clientId, OTHER_PHONE);
		await savePhone(clientId, PHONE);
		expect(await loadRow()).toBeUndefined();
		expect(await loadClientPhone()).toBe(PHONE);
	});

	it('removing the number clears both the verified and the pending number', async () => {
		await db.update(client).set({ phone: PHONE }).where(eq(client.id, clientId));
		await savePhone(clientId, OTHER_PHONE);
		await savePhone(clientId, null);
		expect(await loadRow()).toBeUndefined();
		expect(await loadClientPhone()).toBeNull();
	});
});

describe('sendPhoneCode', () => {
	it('stores a hash of the code, never the code itself', async () => {
		const code = await savedAndSent();
		const row = await loadRow();
		expect(row.otpHash).toBe(hashCode(code));
		expect(row.otpHash).not.toContain(code);
		expect(row.otpAttempts).toBe(0);
		expect(sendWhatsAppTemplate).toHaveBeenCalledWith(PHONE, 'lumno_otp', 'en_US', [code, 'Lumno'], code);
	});

	it('refuses with no pending number', async () => {
		expect(await sendPhoneCode(clientId)).toEqual({ ok: false, reason: 'no_phone' });
		expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
	});

	it('says already_verified when only a verified number exists', async () => {
		await db.update(client).set({ phone: PHONE }).where(eq(client.id, clientId));
		expect(await sendPhoneCode(clientId)).toEqual({ ok: false, reason: 'already_verified' });
	});

	it('blocks a resend within 60s, allows it after', async () => {
		await savedAndSent();
		expect(await sendPhoneCode(clientId)).toEqual({ ok: false, reason: 'cooldown' });
		await pastCooldown();
		expect(await sendPhoneCode(clientId)).toEqual({ ok: true });
	});

	it('does not burn a rate-limit slot when WhatsApp is not configured', async () => {
		isWhatsAppConfigured.mockReturnValueOnce(false);
		await savePhone(clientId, PHONE);
		expect(await sendPhoneCode(clientId)).toEqual({ ok: false, reason: 'not_configured' });
		expect(clientLimit).not.toHaveBeenCalled();
	});

	it('stops at the per-client and per-number rate limits', async () => {
		await savePhone(clientId, PHONE);
		clientLimit.mockResolvedValueOnce({ success: false });
		expect(await sendPhoneCode(clientId)).toEqual({ ok: false, reason: 'rate_limited' });
		numberLimit.mockResolvedValueOnce({ success: false });
		expect(await sendPhoneCode(clientId)).toEqual({ ok: false, reason: 'number_rate_limited' });
		expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
	});

	it('drops the code when Meta rejects the send, so a retry is not blocked', async () => {
		await savePhone(clientId, PHONE);
		sendWhatsAppTemplate.mockRejectedValueOnce(new Error('meta down'));
		expect(await sendPhoneCode(clientId)).toEqual({ ok: false, reason: 'send_failed' });
		const row = await loadRow();
		expect(row.otpHash).toBeNull();
		expect(row.otpExpiresAt).toBeNull();
		expect(await sendPhoneCode(clientId)).toEqual({ ok: true });
	});
});

describe('verifyPhoneCode', () => {
	it('the right code moves the number into client.phone and deletes the row', async () => {
		const code = await savedAndSent();
		expect(await verifyPhoneCode(clientId, code)).toEqual({ ok: true });
		expect(await loadClientPhone()).toBe(PHONE);
		expect(await loadRow()).toBeUndefined();
	});

	it('a wrong code uses up a try and leaves client.phone alone', async () => {
		const code = await savedAndSent();
		let wrong = '000000';
		if (code === wrong) {
			wrong = '111111';
		}
		expect(await verifyPhoneCode(clientId, wrong)).toEqual({
			ok: false,
			reason: 'wrong',
			triesLeft: 4
		});
		expect((await loadRow()).otpAttempts).toBe(1);
		expect(await loadClientPhone()).toBeNull();
	});

	it('locks after 5 wrong tries, even for the right code', async () => {
		const code = await savedAndSent();
		let wrong = '000000';
		if (code === wrong) {
			wrong = '111111';
		}
		for (let i = 0; i < 5; i++) {
			await verifyPhoneCode(clientId, wrong);
		}
		expect(await verifyPhoneCode(clientId, code)).toEqual({ ok: false, reason: 'locked' });
		expect(await loadClientPhone()).toBeNull();
	});

	it('rejects an expired code', async () => {
		const code = await savedAndSent();
		await db
			.update(clientPhoneVerification)
			.set({ otpExpiresAt: new Date(Date.now() - 1000) })
			.where(eq(clientPhoneVerification.clientId, clientId));
		expect(await verifyPhoneCode(clientId, code)).toEqual({ ok: false, reason: 'expired' });
	});

	it('rejects input that is not 6 digits without counting a try', async () => {
		await savedAndSent();
		expect(await verifyPhoneCode(clientId, '12345')).toEqual({ ok: false, reason: 'invalid' });
		expect(await verifyPhoneCode(clientId, 'abcdef')).toEqual({ ok: false, reason: 'invalid' });
		expect((await loadRow()).otpAttempts).toBe(0);
	});

	it('a code sent to the old number cannot verify a newly saved number', async () => {
		const code = await savedAndSent();
		await savePhone(clientId, OTHER_PHONE);
		expect(await verifyPhoneCode(clientId, code)).toEqual({ ok: false, reason: 'no_code' });
		expect(await loadClientPhone()).toBeNull();
	});

	it('changing number keeps the old verified one until the new one is verified', async () => {
		const first = await savedAndSent();
		await verifyPhoneCode(clientId, first);

		await savePhone(clientId, OTHER_PHONE);
		expect(await loadClientPhone()).toBe(PHONE);

		await sendPhoneCode(clientId);
		await verifyPhoneCode(clientId, lastSentCode());
		expect(await loadClientPhone()).toBe(OTHER_PHONE);
	});
});
