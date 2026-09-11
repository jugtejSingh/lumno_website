import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

// Every request goes through hooks.server.ts -> better-auth -> the DB, so the
// dev server is pointed at DATABASE_URL_TEST (schema pushed by the shared
// integration global-setup) and the tests seed their own rows (tests/e2e/seed.ts).
dotenv.config({ quiet: true });

if (!process.env.DATABASE_URL_TEST) {
	throw new Error('DATABASE_URL_TEST is not set — add it to .env');
}

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.test.ts',
	globalSetup: 'tests/integration/global-setup.ts',
	// the dev server compiles each route on first hit, which can stall a cold run
	timeout: 60_000,
	retries: 1,
	webServer: {
		command: 'npm run dev -- --port 4173',
		port: 4173,
		// the env below differs from a stray `npm run dev`, so never adopt one
		reuseExistingServer: false,
		env: {
			...process.env,
			DATABASE_URL: process.env.DATABASE_URL_TEST,
			DIRECT_DATABASE_URL: process.env.DATABASE_URL_TEST,
			ORIGIN: 'http://localhost:4173',
			// fake key so nothing real is emailed; sends fail loudly instead
			RESEND_API: 'test'
		}
	},
	use: {
		baseURL: 'http://localhost:4173'
	}
});
