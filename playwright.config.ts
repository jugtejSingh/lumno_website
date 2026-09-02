import { defineConfig } from '@playwright/test';

// Smoke-level e2e. Needs a working .env (DATABASE_URL etc.) because every request
// goes through hooks.server.ts -> better-auth -> the DB. Deeper flows (booking,
// payments, notes) need a seeded test database and mocked Google OAuth, which
// isn't set up yet.
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.test.ts',
	webServer: {
		command: 'npm run dev -- --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: 'http://localhost:4173'
	}
});
