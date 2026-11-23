import * as Sentry from '@sentry/sveltekit';

// Runs once at server startup, before any app code (enabled via
// experimental.instrumentation.server in vite.config.ts).
let environment = 'development';
if (process.env.VERCEL_ENV) {
	environment = process.env.VERCEL_ENV;
}

// A failed Drizzle query puts the bound values (note text, names, emails) in its message
// as "\nparams: …", and so also at the top of its stack.
const QUERY_PARAMS_START = '\nparams: ';
const STACK_FRAME_LINE = /^ {4}at .*(?::\d+:\d+\)?|\(<anonymous>\)|\(native\)|\(index \d+\))$/;

function removeQueryParams(text: string): string {
	const start = text.indexOf(QUERY_PARAMS_START);
	if (start === -1) {
		return text;
	}
	return text.slice(0, start);
}

// Sentry reads any line containing "at " as a stack frame, so "angry that he left" in a
// note becomes a frame. Only the unbroken run of real frame lines at the end is parsed.
function parseStackWithoutQueryParams(
	stack: string,
	skipFirstLines?: number,
	framesToPop?: number
) {
	if (!stack.includes(QUERY_PARAMS_START)) {
		return Sentry.defaultStackParser(stack, skipFirstLines, framesToPop);
	}

	const lines = stack.split('\n');
	let firstFrame = lines.length;
	while (firstFrame > 0 && STACK_FRAME_LINE.test(lines[firstFrame - 1])) {
		firstFrame--;
	}
	return Sentry.defaultStackParser(lines.slice(firstFrame).join('\n'), 0, framesToPop);
}

Sentry.init({
	// Request bodies are note text, intake answers and passwords. Without this they go out
	// on error reports and on sampled traces of successful requests — don't drop it.
	dataCollection: { httpBodies: [] },
	stackParser: parseStackWithoutQueryParams,
	beforeSend(event) {
		const exceptions = event.exception?.values ?? [];
		for (const exception of exceptions) {
			if (exception.value) {
				exception.value = removeQueryParams(exception.value);
			}
		}
		return event;
	},
	// DSN is a public key, not a secret — it ships to every browser anyway.
	dsn: 'https://21de2d58d2e9f9d4caa42d47f86739e2@o4512293520211968.ingest.de.sentry.io/4512293538168912',
	environment,
	// Free plan: 10% of requests traced is plenty for a low-traffic site.
	tracesSampleRate: 0.1
});
