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
	if (testUrl === process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL_TEST must be a separate database from DATABASE_URL');
	}
	// setup.ts also does this per worker; do it here too for drizzle-kit below
	process.env.DATABASE_URL = testUrl;

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
