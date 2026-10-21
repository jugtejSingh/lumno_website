import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		// Must come before sveltekit(). Uploads source maps on build when
		// SENTRY_AUTH_TOKEN is set; without it the upload is skipped with a warning.
		sentrySvelteKit({
			org: 'lumno',
			project: 'therapist-website',
			authToken: process.env.SENTRY_AUTH_TOKEN
		}),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries — with one
				// exception: svelte-sonner ships uncompiled, runes-only .svelte source
				// (peerDep svelte ^5.0.0, no legacy API), so auto-detect misreads it as
				// legacy and mixing legacy+runes runtimes breaks hydration. Can be
				// removed in svelte 6.
				runes: ({ filename }) => {
					const segments = filename.split(/[/\\]/);
					if (segments.includes('svelte-sonner')) return true;
					return segments.includes('node_modules') ? undefined : true;
				}
			},
			adapter: adapter(),
			// Runs src/instrumentation.server.ts before app code so Sentry can hook in.
			experimental: {
				instrumentation: { server: true },
				tracing: { server: true }
			},
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	],
	// Tunnel hostnames for testing webhooks against the dev server. A leading dot
	// matches the domain and its subdomains. Dev only — Vercel never sees this.
	server: {
		allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io', '.trycloudflare.com']
	},
	// svelte-sonner ships uncompiled .svelte files; Node's SSR loader can't read
	// them directly, so bundle it through the svelte plugin instead of externalizing.
	ssr: {
		noExternal: ['svelte-sonner']
	}
});
