import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// Signature checking is Resend's SDK (svix) — stubbed here. What's under test is what the
// endpoint does with a verified event: flag the matching invite on a permanent bounce only.
const verifyResendWebhook = vi.fn();
vi.mock('$lib/server/email', () => ({
	sendEmail: vi.fn(async () => 'email_new'),
	wrapEmail: vi.fn(() => '<html></html>'),
	escapeHtml: (value: string) => value,
	verifyResendWebhook
}));
vi.mock('$lib/server/log', () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const { db } = await import('$lib/server/db');
const { client } = await import('$lib/server/db/schema');
const { POST } = await import('../../src/routes/webhooks/resend/+server');
const { resendInvite } = await import('$lib/server/clients');
const { resetDb, mkTherapist, mkClient } = await import('./helpers');

let therapistId: string;
let clientId: string;

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
	therapistId = (await mkTherapist()).id;
	clientId = (
		await mkClient(therapistId, {
			email: 'gone@example.com',
			inviteToken: 'tok',
			inviteEmailId: 'email_1'
		})
	).id;
});

function post() {
	const request = new Request('http://localhost/webhooks/resend', {
		method: 'POST',
		body: '{}',
		headers: { 'svix-id': 'a', 'svix-timestamp': '1', 'svix-signature': 'v1,x' }
	});
	return POST({ request } as never);
}

function bounce(emailId: string, type: string) {
	return { type: 'email.bounced', data: { email_id: emailId, bounce: { type, subType: '', message: '' } } };
}

async function bouncedAt() {
	const [row] = await db.select().from(client).where(eq(client.id, clientId));
	return row.inviteBouncedAt;
}

describe('POST /webhooks/resend', () => {
	it('rejects a bad signature with 400 and changes nothing', async () => {
		verifyResendWebhook.mockImplementation(() => {
			throw new Error('bad signature');
		});
		await expect(post()).rejects.toMatchObject({ status: 400 });
		expect(await bouncedAt()).toBeNull();
	});

	it('flags the client on a permanent bounce of their latest invite', async () => {
		verifyResendWebhook.mockReturnValue(bounce('email_1', 'Permanent'));
		const res = await post();
		expect(res.status).toBe(200);
		expect(await bouncedAt()).not.toBeNull();
	});

	it('ignores soft bounces and bounces of an older invite', async () => {
		verifyResendWebhook.mockReturnValue(bounce('email_1', 'Transient'));
		await post();
		verifyResendWebhook.mockReturnValue(bounce('email_old', 'Permanent'));
		await post();
		expect(await bouncedAt()).toBeNull();
	});

	it('accepts other event types with 200', async () => {
		verifyResendWebhook.mockReturnValue({ type: 'email.delivered', data: { email_id: 'email_1' } });
		const res = await post();
		expect(res.status).toBe(200);
	});

	it('clears the bounce flag when the invite is resent', async () => {
		verifyResendWebhook.mockReturnValue(bounce('email_1', 'Permanent'));
		await post();
		await resendInvite(therapistId, clientId, 'http://localhost');
		const [row] = await db.select().from(client).where(eq(client.id, clientId));
		expect(row.inviteBouncedAt).toBeNull();
		expect(row.inviteEmailId).toBe('email_new');
	});
});
