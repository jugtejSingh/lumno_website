import * as Sentry from '@sentry/sveltekit';

// Runs once at server startup, before any app code (enabled via
// experimental.instrumentation.server in vite.config.ts).
let environment = 'development';
if (process.env.VERCEL_ENV) {
	environment = process.env.VERCEL_ENV;
}

Sentry.init({
	// DSN is a public key, not a secret — it ships to every browser anyway.
	dsn: 'https://21de2d58d2e9f9d4caa42d47f86739e2@o4512293520211968.ingest.de.sentry.io/4512293538168912',
	environment,
	// Free plan: 10% of requests traced is plenty for a low-traffic site.
	tracesSampleRate: 0.1
});
