import { defineConfig } from 'drizzle-kit';

let url = process.env.DIRECT_DATABASE_URL;
if (!url) {
	url = process.env.DATABASE_URL;
}
if (!url) throw new Error('DIRECT_DATABASE_URL / DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url },
	verbose: true,
	strict: true
});
