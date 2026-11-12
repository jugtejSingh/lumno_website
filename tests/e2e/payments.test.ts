import { test, expect } from '@playwright/test';
import { gotoHydrated, login, seedClient, seedTherapist } from './seed';

// The portal "Pay now" button is commented out in the app (Razorpay checkout is
// disabled), so the payment flow under test is the therapist adding a charge and
// the client seeing it land as a balance due.
test.describe('therapist adds a charge', () => {
	test('a charge shows up under "Who owes you" and on the client portal', async ({
		page,
		request
	}) => {
		const therapist = await seedTherapist(request);
		const client = await seedClient(request, therapist.therapistId);

		await login(page, 'Therapist', therapist.email);
		await gotoHydrated(page, '/payments');
		await page.getByRole('button', { name: '+ Add charge' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		// the client select defaults to the first (only) client
		await expect(dialog.getByLabel('Client')).toHaveValue(client.name);
		await dialog.getByLabel('Amount').fill('150');
		await dialog.getByLabel('Note').fill('Late cancellation fee');
		await dialog.getByRole('button', { name: 'Add charge', exact: true }).click();

		await expect(dialog).toBeHidden();
		const row = page.locator('.balance-row', { hasText: client.name });
		await expect(row).toBeVisible();
		await expect(row.locator('.balance-owed')).toHaveText(/150/);

		// the client sees the same charge as their balance due
		await page.context().clearCookies();
		await login(page, 'Client', client.email);
		await expect(page).toHaveURL(/\/portal$/);
		await gotoHydrated(page, '/portal/payments');
		await expect(page.locator('.stat-card', { hasText: 'Balance due' })).toContainText(/150/);
		await expect(page.getByText('Late cancellation fee')).toBeVisible();
		await expect(page.locator('.invoice-list')).toContainText('unpaid');
	});

	test('the therapist can mark a charge paid by hand and the client sees it', async ({
		page,
		request
	}) => {
		const therapist = await seedTherapist(request);
		const client = await seedClient(request, therapist.therapistId);

		await login(page, 'Therapist', therapist.email);
		await gotoHydrated(page, '/payments');
		await page.getByRole('button', { name: '+ Add charge' }).click();
		const addDialog = page.getByRole('dialog');
		await addDialog.getByLabel('Amount').fill('150');
		await addDialog.getByLabel('Note').fill('Session fee');
		await addDialog.getByRole('button', { name: 'Add charge', exact: true }).click();
		await expect(addDialog).toBeHidden();

		// open the client's history from "Who owes you" and settle the charge manually
		await page.locator('.balance-row', { hasText: client.name }).click();
		const history = page.getByRole('dialog');
		await expect(history.locator('.dialog-title')).toHaveText(`${client.name} — payment history`);
		// each row is a disclosure; Mark paid sits inside it
		const historyRow = history.locator('details.row', { hasText: 'Session fee' });
		await expect(historyRow.locator('.row-status')).toContainText('unpaid');
		await historyRow.locator('summary').click();
		await historyRow.getByRole('button', { name: 'Mark paid' }).click();

		await expect(historyRow.locator('.row-status')).not.toContainText('unpaid');
		await expect(historyRow.getByRole('button', { name: 'Mark paid' })).toHaveCount(0);
		await expect(history.locator('.stat', { hasText: 'Owed' })).toContainText(/0/);
		await history.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByText('No outstanding balances.')).toBeVisible();

		// the client's portal now shows it as paid, nothing due
		await page.context().clearCookies();
		await login(page, 'Client', client.email);
		await expect(page).toHaveURL(/\/portal$/);
		await gotoHydrated(page, '/portal/payments');
		await expect(page.locator('.stat-card', { hasText: 'Balance due' })).not.toContainText(/150/);
		// paid charges are never listed to the client, so the list is empty
		await expect(page.getByText('Nothing to show yet.')).toBeVisible();
		await expect(page.locator('.invoice-list')).not.toContainText('unpaid');
	});

	test('an empty amount is rejected with the exact message', async ({ page, request }) => {
		const therapist = await seedTherapist(request);
		await seedClient(request, therapist.therapistId);

		await login(page, 'Therapist', therapist.email);
		await gotoHydrated(page, '/payments');
		await page.getByRole('button', { name: '+ Add charge' }).click();

		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Add charge', exact: true }).click();

		await expect(dialog.locator('.form-error')).toHaveText('Enter a whole number amount greater than 0');
		await expect(dialog).toBeVisible();
		await expect(page.getByText('No outstanding balances.')).toBeVisible();
	});
});

test.describe('period switch', () => {
	test('switching periods updates the stat cards', async ({ page, request }) => {
		const therapist = await seedTherapist(request);
		await seedClient(request, therapist.therapistId);

		await login(page, 'Therapist', therapist.email);
		await gotoHydrated(page, '/payments');
		const unpaid = page.locator('.stat-card', { hasText: 'Unpaid' }).locator('.stat-value');
		await expect(page.getByRole('link', { name: 'Last 30 days' })).toHaveAttribute('aria-current', 'page');
		await expect(unpaid).toHaveText(/\b0\b/);

		// an ad-hoc charge counts straight away, dated today
		await page.getByRole('button', { name: '+ Add charge' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Amount').fill('250');
		await dialog.getByRole('button', { name: 'Add charge', exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(unpaid).toHaveText(/250/);

		await page.getByRole('link', { name: 'Monthly' }).click();
		await expect(page).toHaveURL(/period=month:/);
		await expect(unpaid).toHaveText(/250/);

		// last month has nothing
		await page.getByRole('link', { name: 'Previous' }).click();
		await expect(unpaid).toHaveText(/\b0\b/);

		await page.getByRole('link', { name: 'Yearly' }).click();
		await expect(page).toHaveURL(/period=year:/);
		await expect(unpaid).toHaveText(/250/);

		await page.getByRole('link', { name: 'Last 365 days' }).click();
		await expect(unpaid).toHaveText(/250/);
	});
});
