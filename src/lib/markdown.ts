import { marked } from 'marked';

// Therapist-written note markdown is rendered into {@html} on both the notes page and
// the client portal. marked does not sanitize HTML/script input.
export function renderMarkdown(source: string): string {
	return marked.parse(source, { async: false });
}
