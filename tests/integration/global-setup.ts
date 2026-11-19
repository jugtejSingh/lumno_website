import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import dotenv from 'dotenv';

const overlapSql = fileURLToPath(
	new URL('../../src/lib/server/db/appointment_no_overlap.sql', import.meta.url)
);

// Runs once before the integration suite: point every DB import at
// DATABASE_URL_TEST, push the current schema, install the overlap trigger.
export default async function setup() {
	dotenv.config({ quiet: true });

	const testUrl = process.env.DATABASE_URL_TEST;
	if (!testUrl) {
		throw new Error('DATABASE_URL_TEST is not set — add it to .env');
	}
	// the schema is wiped below, so refuse if the test URL is any real database
	const realUrls = [
		process.env.DATABASE_URL,
		process.env.DIRECT_DATABASE_URL,
		process.env.DATABASE_URL_MIGRATE
	];
	for (const realUrl of realUrls) {
		if (realUrl && testUrl === realUrl) {
			throw new Error('DATABASE_URL_TEST must be a separate database from the real ones');
		}
	}
	// setup.ts also does this per worker; do it here too for drizzle-kit below
	process.env.DATABASE_URL = testUrl;

	// drizzle-kit push only works on an empty schema: on an existing one it re-drops the
	// availability_date_override composite PK every time and dies. Start from empty each run.
	const reset = postgres(testUrl, { onnotice: () => {} });
	await reset.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
	await reset.end();

	// drizzle.config.ts prefers DIRECT_DATABASE_URL — override it too, or the push
	// lands on the dev DB instead of the local test one.
	execSync('npx drizzle-kit push --force', {
		stdio: 'inherit',
		env: { ...process.env, DATABASE_URL: testUrl, DIRECT_DATABASE_URL: testUrl }
	});

	const sql = postgres(testUrl);
	await sql.unsafe(readFileSync(overlapSql, 'utf8'));
	await sql.end();
}
