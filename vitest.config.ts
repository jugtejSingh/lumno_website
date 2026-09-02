import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Two suites:
//   unit        - pure modules under src/lib, no DB, no aliases needed
//   integration - server modules against a real Postgres (DATABASE_URL_TEST).
//                 $lib / $env are aliased so the SvelteKit plugin isn't needed.
export default defineConfig({
	resolve: {
		alias: {
			'$env/dynamic/private': r('./tests/shims/env.ts'),
			'$app/server': r('./tests/shims/app-server.ts'),
			$lib: r('./src/lib')
		}
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['tests/unit/**/*.test.ts']
				}
			},
			{
				extends: true,
				test: {
					name: 'integration',
					include: ['tests/integration/**/*.test.ts'],
					globalSetup: ['tests/integration/global-setup.ts'],
					setupFiles: ['tests/integration/setup.ts'],
					// each test file gets its own DB connection; run them serially so
					// truncate-between-tests in one file can't wipe another's rows
					fileParallelism: false,
					hookTimeout: 30_000
				}
			}
		]
	}
});
