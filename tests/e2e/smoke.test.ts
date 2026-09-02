import { test, expect } from '@playwright/test';

test('home page renders the hero and CTA', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Run your practice/i })).toBeVisible();
	await expect(page.locator('a[href="/login?tab=register"]').first()).toBeVisible();
});

test('login page renders both roles and the login form', async ({ page }) => {
	await page.goto('/login');
	await expect(page).toHaveTitle(/Log in/);
	await expect(page.getByRole('button', { name: 'Therapist' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Client' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('register tab is reachable from the CTA', async ({ page }) => {
	await page.goto('/login?tab=register');
	await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});

test('the app area redirects anonymous users to login', async ({ page }) => {
	await page.goto('/dashboard');
	await expect(page).toHaveURL(/\/login$/);
});

test('the portal redirects anonymous users to login', async ({ page }) => {
	await page.goto('/portal');
	await expect(page).toHaveURL(/\/login$/);
});
