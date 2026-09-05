import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
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
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	],
	// svelte-sonner ships uncompiled .svelte files; Node's SSR loader can't read
	// them directly, so bundle it through the svelte plugin instead of externalizing.
	ssr: {
		noExternal: ['svelte-sonner']
	}
});
