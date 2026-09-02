// Stands in for SvelteKit's $env/dynamic/private in tests — same shape (an
// object of string env vars), sourced straight from process.env.
export const env = process.env as Record<string, string>;
