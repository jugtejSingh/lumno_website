import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });

// The type `db.transaction`'s callback receives its `tx` argument as — narrower than
// `typeof db` (no `$client`), so functions that must run inside a caller's transaction
// take this union instead of `typeof db` and work with either.
export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
