import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import * as schema from '../../src/lib/server/db/schema';

// The schema files only import drizzle, so they load fine under Playwright's own
// TS loader — no $lib / $env aliases needed. playwright.config.ts loaded .env.
export const db = drizzle(postgres(process.env.DATABASE_URL_TEST!, { prepare: false }), { schema });

export const PASSWORD = 'password-e2e-123';

// Therapists default to Asia/Kolkata (no DST), so a fixed +05:30 is exact.
const IST_OFFSET_MINUTES = 330;

export function istToUtc(year: number, month: number, day: number, hour: number, minute: number) {
	return new Date(Date.UTC(year, month, day, hour, minute) - IST_OFFSET_MINUTES * 60_000);
}

// Sign up through better-auth's own endpoint so the password hash and account row
// are exactly what login expects, then flip the user to verified by hand
// (requireEmailVerification would otherwise block the login form).
async function signUp(request: APIRequestContext, name: string) {
	const email = `${randomUUID()}@e2e.test`;
	// ponytail: the Vite dev server occasionally resets a socket under 4 parallel
	// workers; one retry covers it. Switch to a preview build if it keeps happening.
	let response;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			response = await request.post('/api/auth/sign-up/email', {
				data: { email, password: PASSWORD, name }
			});
			break;
		} catch (error) {
			if (attempt === 2 || !String(error).includes('ECONNRESET')) {
				throw error;
			}
		}
	}
	expect(response!.ok(), `sign-up failed: ${await response!.text()}`).toBe(true);
	const [row] = await db
		.update(schema.user)
		.set({ emailVerified: true })
		.where(eq(schema.user.email, email))
		.returning({ id: schema.user.id });
	return { userId: row.id, email, name };
}

// Mirrors createTherapistProfile: the settings rows must exist or every settings
// getter on the app side falls over.
export async function seedTherapist(request: APIRequestContext) {
	const account = await signUp(request, 'Dana Reyes');
	const [therapistRow] = await db
		.insert(schema.therapist)
		.values({ userId: account.userId, slug: `e2e-${randomUUID().slice(0, 8)}` })
		.returning();
	await db.insert(schema.therapistSettings).values({ therapistId: therapistRow.id });
	await db.insert(schema.paymentSettings).values({ therapistId: therapistRow.id });
	return { ...account, therapistId: therapistRow.id };
}

export async function seedClient(request: APIRequestContext, therapistId: string) {
	const account = await signUp(request, 'Sam Client');
	const [clientRow] = await db
		.insert(schema.client)
		.values({
			therapistId,
			userId: account.userId,
			name: account.name,
			email: account.email,
			rate: 1000
		})
		.returning();
	return { ...account, clientId: clientRow.id };
}

export async function seedAppointment(therapistId: string, clientId: string, startAt: Date, endAt: Date) {
	const [row] = await db
		.insert(schema.appointment)
		.values({ therapistId, clientId, startAt, endAt, modality: 'online' })
		.returning();
	return row;
}

// the therapist card also has a "Log in" mode tab, so pin the submit button
export function loginSubmitButton(page: Page) {
	return page.locator('button[type="submit"]', { hasText: 'Log in' });
}

// Clicks before Svelte hydrates are silently dropped (role pills, day cells,
// "+ Add charge"), so wait for the dev server's module traffic to settle first.
export async function gotoHydrated(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

export async function login(page: Page, role: 'Therapist' | 'Client', email: string, password = PASSWORD) {
	await gotoHydrated(page, '/login');
	await page.getByRole('button', { name: role, exact: true }).click();
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await loginSubmitButton(page).click();
	// the action either redirects off /login or renders an error — wait for one
	// of those, or a following page.goto() aborts the in-flight submission
	await Promise.race([
		page.waitForURL((url) => !url.pathname.startsWith('/login')),
		page.locator('.form-error').waitFor()
	]);
}
