// One place every server-side failure is written from, so a grep for "[scope]"
// finds it. Structured enough for Vercel's log search, plain enough to read.
// ponytail: console only — swap the sink here if a log drain is ever added.
export function logError(scope: string, err: unknown, context: Record<string, unknown> = {}) {
	const message = err instanceof Error ? err.message : String(err);
	const stack = err instanceof Error ? err.stack : undefined;
	console.error(`[${scope}] ${message}`, { ...context, stack });
}

export function logInfo(scope: string, message: string, context: Record<string, unknown> = {}) {
	console.log(`[${scope}] ${message}`, context);
}
