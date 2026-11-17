// drizzle-orm wraps driver errors in a DrizzleQueryError whose real Postgres
// error (with .code) is on .cause — check both shapes, since which one shows
// up depends on the drizzle version.
export function isUniqueViolation(err: unknown): boolean {
	if (err instanceof Error && 'code' in err && err.code === '23505') {
		return true;
	}
	const cause = err instanceof Error ? err.cause : undefined;
	return Boolean(cause instanceof Error && 'code' in cause && cause.code === '23505');
}
