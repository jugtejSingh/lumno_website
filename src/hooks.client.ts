import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	// DSN is a public key, not a secret — it ships to every browser anyway.
	dsn: 'https://21de2d58d2e9f9d4caa42d47f86739e2@o4512293520211968.ingest.de.sentry.io/4512293538168912',
	environment: import.meta.env.MODE,
	tracesSampleRate: 0.1,
	integrations: [
		// Everything on screen is client/session data — mask all text, block all media.
		Sentry.replayIntegration({
			maskAllText: true,
			blockAllMedia: true
		})
	],
	// Free plan has a small replay quota: only record sessions that hit an error.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1.0
});

// Sentry skips 4xx (404s etc.) on its own; only real crashes are reported.
export const handleError = Sentry.handleErrorWithSentry();
