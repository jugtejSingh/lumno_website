import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createTherapistProfile } from '$lib/server/therapistProfile';
import {
	user,
	therapist,
	client,
	therapistSettings,
	paymentSettings,
	paymentPack,
	payment,
	appointment,
	organization,
	subscription,
	clientNote
} from '$lib/server/db/schema';

const TABLES = [
	'client_note',
	'razorpay_event',
	'razorpay_reconcile_exception',
	'therapist_razorpay_connection',
	'payment',
	'payment_pack',
	'payment_settings',
	'appointment',
	'availability_slot',
	'availability_date_override',
	'therapist_settings',
	'subscription',
	'client',
	'organization',
	'therapist',
	'"session"',
	'account',
	'verification',
	'"user"'
];

export async function resetDb() {
	await db.execute(sql.raw(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`));
}

export async function mkUser(overrides: Partial<typeof user.$inferInsert> = {}) {
	const id = overrides.id ?? randomUUID();
	const [row] = await db
		.insert(user)
		.values({ id, name: 'Test User', email: `${id}@example.com`, ...overrides })
		.returning();
	return row;
}

export async function mkTherapist(overrides: Partial<typeof therapist.$inferInsert> = {}) {
	const u = await mkUser();
	const row = await createTherapistProfile(u.id, {
		slug: `t-${randomUUID().slice(0, 8)}`,
		...overrides
	});
	return { ...row, user: u };
}

export async function mkClient(
	therapistId: string,
	overrides: Partial<typeof client.$inferInsert> = {}
) {
	const [row] = await db
		.insert(client)
		.values({ therapistId, name: 'Test Client', rate: 1000, ...overrides })
		.returning();
	return row;
}

// The row already exists (seeded by createTherapistProfile) — these just patch it.
export async function mkSettings(
	therapistId: string,
	overrides: Partial<typeof therapistSettings.$inferInsert>
) {
	const [row] = await db
		.update(therapistSettings)
		.set(overrides)
		.where(eq(therapistSettings.therapistId, therapistId))
		.returning();
	return row;
}

export async function mkPaymentSettings(
	therapistId: string,
	overrides: Partial<typeof paymentSettings.$inferInsert>
) {
	const [row] = await db
		.update(paymentSettings)
		.set(overrides)
		.where(eq(paymentSettings.therapistId, therapistId))
		.returning();
	return row;
}

export async function mkPack(
	therapistId: string,
	clientId: string,
	overrides: Partial<typeof paymentPack.$inferInsert> = {}
) {
	const [row] = await db
		.insert(paymentPack)
		.values({ therapistId, clientId, sessionCount: 10, amount: 9000, ...overrides })
		.returning();
	return row;
}

export async function mkPayment(
	therapistId: string,
	clientId: string,
	overrides: Partial<typeof payment.$inferInsert> = {}
) {
	const [row] = await db
		.insert(payment)
		.values({ therapistId, clientId, amount: 1000, ...overrides })
		.returning();
	return row;
}

export async function mkAppointment(
	therapistId: string,
	clientId: string,
	overrides: Partial<typeof appointment.$inferInsert> = {}
) {
	const start = overrides.startAt ?? new Date('2026-10-01T10:00:00Z');
	const end = overrides.endAt ?? new Date(start.getTime() + 60 * 60_000);
	const [row] = await db
		.insert(appointment)
		.values({ therapistId, clientId, startAt: start, endAt: end, modality: 'online', ...overrides })
		.returning();
	return row;
}

export async function mkOrg(
	ownerTherapistId: string,
	overrides: Partial<typeof organization.$inferInsert> = {}
) {
	const [row] = await db
		.insert(organization)
		.values({ name: 'Test Org', ownerTherapistId, ...overrides })
		.returning();
	return row;
}

export async function mkSubscription(overrides: Partial<typeof subscription.$inferInsert> = {}) {
	const [row] = await db
		.insert(subscription)
		.values({
			plan: 1,
			status: 'active',
			razorpaySubscriptionId: `sub_${randomUUID().slice(0, 12)}`,
			...overrides
		})
		.returning();
	return row;
}

export async function mkNote(
	therapistId: string,
	clientId: string,
	overrides: Partial<typeof clientNote.$inferInsert> = {}
) {
	const [row] = await db
		.insert(clientNote)
		.values({ therapistId, clientId, body: 'note body', ...overrides })
		.returning();
	return row;
}

// A minimal SvelteKit RequestEvent for calling a route's load/actions directly. `fields`
// become a urlencoded form body; repeat a key by passing an array. Cast at the call site
// (`as never`) — route handlers only read the parts given here.
export function mkEvent(
	options: {
		locals?: Record<string, unknown>;
		fields?: Record<string, string | string[]>;
		url?: string;
		params?: Record<string, string>;
		parent?: () => Promise<unknown>;
	} = {}
) {
	const url = new URL(options.url ?? 'http://localhost/');
	const body = new URLSearchParams();
	const fields = options.fields ?? {};
	for (const key of Object.keys(fields)) {
		const value = fields[key];
		if (Array.isArray(value)) {
			for (const item of value) {
				body.append(key, item);
			}
		} else {
			body.append(key, value);
		}
	}
	const request = new Request(url, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	return {
		locals: options.locals ?? {},
		url,
		params: options.params ?? {},
		request,
		parent: options.parent ?? (async () => ({})),
		cookies: { get: () => undefined, set: () => {}, delete: () => {} }
	};
}
