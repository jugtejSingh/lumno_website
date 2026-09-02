// Stands in for SvelteKit's $app/server in tests. Only auth.ts imports it, via
// sveltekitCookies(); no integration test drives a real request through it.
export function getRequestEvent(): never {
	throw new Error('getRequestEvent() is not available in tests');
}
