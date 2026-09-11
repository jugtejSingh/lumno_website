import { test, expect } from '@playwright/test';
import { gotoHydrated, login, seedClient, seedTherapist } from './seed';

// The portal "Pay now" button is commented out in the app (Razorpay checkout is
// disabled), so the payment flow under test is the therapist adding a charge and
// the client seeing it land as a balance due.
test.describe('therapist adds a charge', () => {
	test('a charge shows up under "Who owes what" and on the client portal', async ({
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
		await expect(page.getByText('Balance due').locator('..')).toContainText(/150/);
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

		// open the client's history from "Who owes what" and settle the charge manually
		await page.locator('.balance-row', { hasText: client.name }).click();
		const history = page.getByRole('dialog');
		await expect(history.locator('.dialog-title')).toHaveText(`${client.name} — payment history`);
		const historyRow = history.locator('.history-row', { hasText: 'Session fee' });
		await expect(historyRow.getByText('unpaid', { exact: true })).toBeVisible();
		await historyRow.getByRole('button', { name: 'Mark paid' }).click();

		await expect(historyRow.getByText('paid', { exact: true })).toBeVisible();
		await expect(historyRow.getByRole('button', { name: 'Mark paid' })).toHaveCount(0);
		await expect(history.locator('.stat', { hasText: 'Owed' })).toContainText(/0/);
		await history.getByRole('button', { name: 'Close' }).click();
		await expect(page.locator('.balance-list')).toContainText('No outstanding balances.');

		// the client's portal now shows it as paid, nothing due
		await page.context().clearCookies();
		await login(page, 'Client', client.email);
		await expect(page).toHaveURL(/\/portal$/);
		await expect(page.getByText('Paid total').locator('..')).toContainText(/150/);
		await expect(page.getByText('Balance due').locator('..')).not.toContainText(/150/);
		await expect(page.locator('.invoice-list')).toContainText('paid');
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

		await expect(dialog.locator('.form-error')).toHaveText('Enter an amount greater than 0');
		await expect(dialog).toBeVisible();
		await expect(page.locator('.balance-list')).toContainText('No outstanding balances.');
	});
});
