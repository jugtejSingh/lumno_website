import { describe, it, expect, vi, afterEach } from 'vitest';
import { logError } from '../../src/lib/server/log';

const SECRET = 'client-note@example.com';

// Same shape drizzle-orm's DrizzleQueryError builds: values in the message, plus query/params fields.
function failedQuery() {
	const cause = Object.assign(new Error('duplicate key value violates unique constraint "user_email_unique"'), {
		code: '23505',
		detail: `Key (email)=(${SECRET}) already exists.`
	});
	return Object.assign(new Error(`Failed query: insert into "user" ("email") values ($1)\nparams: ${SECRET}`, { cause }), {
		query: 'insert into "user" ("email") values ($1)',
		params: [SECRET]
	});
}

describe('logError', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps the query and error codes but never the bound values', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

		logError('test.scope', new Error('outer failure', { cause: failedQuery() }), { userId: 'u1' });

		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).not.toContain(SECRET);
		expect(logged).toContain('insert into');
		expect(logged).toContain('23505');
		expect(logged).toContain('u1');
	});
});
