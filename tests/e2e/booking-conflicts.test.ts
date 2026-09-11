import { test, expect } from '@playwright/test';
import { and, eq, ne } from 'drizzle-orm';
import {
	db,
	gotoHydrated,
	istToUtc,
	login,
	seedAppointment,
	seedClient,
	seedTherapist
} from './seed';
import { appointment } from '../../src/lib/server/db/schema';

const TIMEZONE = 'Asia/Kolkata';

// Same formatters the calendar action uses, so the assertion is exact even if
// Node's ICU picks a narrow no-break space before "AM".
function expectedOverlapMessage(startAt: Date, endAt: Date) {
	const format = new Intl.DateTimeFormat('en-US', {
		timeZone: TIMEZONE,
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
	const timeOnly = new Intl.DateTimeFormat('en-US', {
		timeZone: TIMEZONE,
		hour: 'numeric',
		minute: '2-digit'
	});
	return `That overlaps your confirmed session on ${format.format(startAt)} – ${timeOnly.format(endAt)} (including your buffer time)`;
}

function nextMonth() {
	const now = new Date();
	let year = now.getFullYear();
	let month = now.getMonth() + 1;
	if (month > 11) {
		month = 0;
		year = year + 1;
	}
	return { year, month };
}

test.describe('therapist calendar conflicts', () => {
	test('booking over an existing session is blocked with the exact overlap message', async ({
		page,
		request
	}) => {
		const therapist = await seedTherapist(request);
		const client = await seedClient(request, therapist.therapistId);
		const { year, month } = nextMonth();
		const day = 15;
		const existingStart = istToUtc(year, month, day, 9, 0);
		const existingEnd = istToUtc(year, month, day, 10, 0);
		await seedAppointment(therapist.therapistId, client.clientId, existingStart, existingEnd);

		await login(page, 'Therapist', therapist.email);
		await gotoHydrated(page, `/calendar?year=${year}&month=${month}`);

		const dayCell = page.locator('.cell', {
			has: page.locator('.cell-num', { hasText: new RegExp(`^${day}$`) })
		});
		await dayCell.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: '+ Add appointment' }).click();

		// form defaults are 09:00–10:00 — exactly the seeded slot
		await dialog.getByRole('button', { name: 'Add appointment', exact: true }).click();

		await expect(dialog.locator('.form-error')).toHaveText(
			expectedOverlapMessage(existingStart, existingEnd)
		);

		const rows = await db
			.select({ id: appointment.id })
			.from(appointment)
			.where(
				and(
					eq(appointment.therapistId, therapist.therapistId),
					ne(appointment.status, 'cancelled')
				)
			);
		expect(rows).toHaveLength(1);
	});

	test('a non-overlapping time still books fine', async ({ page, request }) => {
		const therapist = await seedTherapist(request);
		const client = await seedClient(request, therapist.therapistId);
		const { year, month } = nextMonth();
		const day = 15;
		await seedAppointment(
			therapist.therapistId,
			client.clientId,
			istToUtc(year, month, day, 9, 0),
			istToUtc(year, month, day, 10, 0)
		);

		await login(page, 'Therapist', therapist.email);
		await gotoHydrated(page, `/calendar?year=${year}&month=${month}`);
		await page
			.locator('.cell', { has: page.locator('.cell-num', { hasText: new RegExp(`^${day}$`) }) })
			.click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: '+ Add appointment' }).click();

		// 11:00 AM – 12:00 PM via the 12h picker (hour select, minute input, AM/PM select)
		const startField = dialog.locator('label.field', { hasText: 'Start' });
		await startField.locator('select').first().selectOption('11');
		const endField = dialog.locator('label.field', { hasText: 'End' });
		await endField.locator('select').first().selectOption('12');
		await endField.locator('select').nth(1).selectOption('PM');

		await dialog.getByRole('button', { name: 'Add appointment', exact: true }).click();

		await expect(dialog.locator('.form-error')).toHaveCount(0);
		await expect(dialog.locator('.dialog-time', { hasText: '11:00' })).toBeVisible();

		const rows = await db
			.select({ id: appointment.id })
			.from(appointment)
			.where(eq(appointment.therapistId, therapist.therapistId));
		expect(rows).toHaveLength(2);
	});
});

test.describe('client portal conflicts', () => {
	test('a slot taken after the page loaded is refused with the exact message', async ({
		page,
		request
	}) => {
		const therapist = await seedTherapist(request);
		const client = await seedClient(request, therapist.therapistId);

		await login(page, 'Client', client.email);
		await expect(page).toHaveURL(/\/portal$/);

		// open days only exist in the next 14 days — at month end they're all in the next month
		const availableDays = page.locator('.cell.available');
		if ((await availableDays.count()) === 0) {
			await page.getByRole('button', { name: 'Next month' }).click();
		}
		await expect(availableDays.first()).toBeVisible();
		await availableDays.first().click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		const firstSlotForm = dialog.locator('form').first();
		const year = Number(await firstSlotForm.locator('input[name="year"]').inputValue());
		const month = Number(await firstSlotForm.locator('input[name="month"]').inputValue());
		const day = Number(await firstSlotForm.locator('input[name="day"]').inputValue());
		const startTime = await firstSlotForm.locator('input[name="startTime"]').inputValue();
		const [hour, minute] = startTime.split(':').map(Number);

		// someone else grabs that exact slot behind the client's back
		const startAt = istToUtc(year, month, day, hour, minute);
		const endAt = new Date(startAt.getTime() + 60 * 60_000);
		await seedAppointment(therapist.therapistId, client.clientId, startAt, endAt);

		await firstSlotForm.locator('.slot-btn').click();

		await expect(dialog.locator('.form-error')).toHaveText('That time is no longer available');

		const rows = await db
			.select({ id: appointment.id })
			.from(appointment)
			.where(eq(appointment.therapistId, therapist.therapistId));
		expect(rows).toHaveLength(1);
	});
});
