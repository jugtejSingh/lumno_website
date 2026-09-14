// One place every server-side failure is written from, so a grep for "[scope]"
// finds it. Structured enough for Vercel's log search, plain enough to read.
// ponytail: console only — swap the sink here if a log drain is ever added.

type DescribedError = { message: string; stack?: string; code?: unknown; cause?: DescribedError };

// Keeps only message, stack and code from an error (and its cause chain) — never the
// rest of its fields. A failed Drizzle query carries the bound values (note text, emails,
// names) in its message/stack as "params: …", and Postgres puts them in `detail`
// ("Key (email)=(…) already exists"), so both are dropped before anything is logged.
function describeError(err: unknown): DescribedError {
	if (!(err instanceof Error)) {
		return { message: String(err) };
	}

	let message = err.message;
	let stack = err.stack;
	if ('query' in err && 'params' in err) {
		message = `Failed query: ${String(err.query)}`;
		if (stack) {
			stack = stack.replace(err.message, message);
		}
	}

	const described: DescribedError = { message, stack };
	if ('code' in err) {
		described.code = err.code;
	}
	if (err.cause !== undefined) {
		described.cause = describeError(err.cause);
	}
	return described;
}

export function logError(scope: string, err: unknown, context: Record<string, unknown> = {}) {
	const { message, ...details } = describeError(err);
	console.error(`[${scope}] ${message}`, { ...context, ...details });
}

export function logInfo(scope: string, message: string, context: Record<string, unknown> = {}) {
	console.log(`[${scope}] ${message}`, context);
}
