import { test, expect } from '@playwright/test';
import { login, loginSubmitButton, seedClient, seedTherapist } from './seed';

const GENERIC_SIGN_IN_MESSAGE =
	'Either the email or password is incorrect, or the account is not in our system.';

test.describe('login', () => {
	test('therapist with correct credentials lands on the dashboard', async ({ page, request }) => {
		const therapist = await seedTherapist(request);
		await login(page, 'Therapist', therapist.email);
		await expect(page).toHaveURL(/\/dashboard$/);
	});

	test('wrong password shows the generic sign-in error', async ({ page, request }) => {
		const therapist = await seedTherapist(request);
		await login(page, 'Therapist', therapist.email, 'definitely-wrong');
		await expect(page.locator('.form-error')).toHaveText(GENERIC_SIGN_IN_MESSAGE);
		await expect(page).toHaveURL(/\/login/);
	});

	test('empty form shows the missing-fields error', async ({ page }) => {
		await page.goto('/login');
		await loginSubmitButton(page).click();
		await expect(page.locator('.form-error')).toHaveText('Enter your email and password.');
	});

	test('therapist picking the Client pill is told there is no client profile', async ({
		page,
		request
	}) => {
		const therapist = await seedTherapist(request);
		await login(page, 'Client', therapist.email);
		await expect(page.locator('.form-error')).toHaveText(
			'This account has no client profile. Ask your therapist for an invite.'
		);
	});

	test('client picking the Therapist pill is told there is no practice', async ({
		page,
		request
	}) => {
		const therapist = await seedTherapist(request);
		const client = await seedClient(request, therapist.therapistId);
		await login(page, 'Therapist', client.email);
		await expect(page.locator('.form-error')).toHaveText('This account has no practice set up.');
	});

	test('client with correct credentials lands on the portal', async ({ page, request }) => {
		const therapist = await seedTherapist(request);
		const client = await seedClient(request, therapist.therapistId);
		await login(page, 'Client', client.email);
		await expect(page).toHaveURL(/\/portal$/);
		await expect(page.getByText(`Welcome back, ${client.name}`)).toBeVisible();
	});
});
