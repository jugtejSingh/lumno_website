import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Therapist-written note markdown is rendered into {@html} on both the notes page and
// the client portal. marked does not sanitize, so strip scripts/handlers before it lands.
export function renderMarkdown(source: string): string {
	const html = marked.parse(source, { async: false });
	return DOMPurify.sanitize(html);
}
