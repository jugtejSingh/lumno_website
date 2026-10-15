import { test, expect } from '@playwright/test';

test('home page renders the hero and CTA', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Why juggle five apps/i })).toBeVisible();
	await expect(page.locator('a[href="/login?tab=register"]').first()).toBeVisible();
});

test('practitioner login page renders the login form', async ({ page }) => {
	await page.goto('/login');
	await expect(page).toHaveTitle(/Practitioner log in/);
	await expect(page.getByRole('button', { name: 'Register' }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('client login page renders the login form without register', async ({ page }) => {
	await page.goto('/login/client');
	await expect(page).toHaveTitle(/Client log in/);
	await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('navbar links to both login pages', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('a[href="/login/client"]').first()).toBeVisible();
	await expect(page.locator('a[href="/login"]').first()).toBeVisible();
});

test('register tab is reachable from the CTA', async ({ page }) => {
	await page.goto('/login?tab=register');
	await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});

test('the app area redirects anonymous users to login', async ({ page }) => {
	await page.goto('/dashboard');
	await expect(page).toHaveURL(/\/login$/);
});

test('the portal redirects anonymous users to the client login', async ({ page }) => {
	await page.goto('/portal');
	await expect(page).toHaveURL(/\/login\/client$/);
});
