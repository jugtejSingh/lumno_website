import { env } from '$env/dynamic/private';
import { logError } from '$lib/server/log';

// Only ever fixes up wording already in the note — never invents new clinical
// content. Kept to grammar/clarity/flow so a therapist can trust the output
// without re-reading every sentence against the original.
const SYSTEM_PROMPT =
	"You clean up a therapist's session note. Fix grammar, spelling, and punctuation, and improve clarity and flow. You may elaborate on what's already written to make it read more naturally, but never invent new facts, symptoms, events, or details that aren't already in the note — only work with what's given. Reply with only the fixed note text, no preamble or commentary.";

export async function fixNoteText(body: string): Promise<string | null> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		logError('ai.fixNote', new Error('OPENROUTER_API_KEY not set'));
		return null;
	}

	try {
		const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash',
				// Session notes are health data: zdr keeps routing to Zero Data Retention endpoints
				// only, and data_collection 'deny' rules out any provider that trains on or stores
				// prompts. DeepSeek's own endpoint isn't ZDR, so it's out; Novita and Baseten are
				// (checked against openrouter.ai/api/v1/endpoints/zdr, 2026-09). If both are down
				// the request fails rather than falling back to a non-ZDR provider.
				provider: {
					order: ['Novita', 'Baseten'],
					allow_fallbacks: true,
					zdr: true,
					data_collection: 'deny'
				},
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: body }
				]
			}),
			// don't hold the request open forever if the provider hangs
			signal: AbortSignal.timeout(30_000)
		});
		if (!res.ok) {
			logError('ai.fixNote', new Error(`OpenRouter responded ${res.status}`), { status: res.status });
			return null;
		}
		const data = await res.json();
		const fixed = data.choices?.[0]?.message?.content?.trim();
		return fixed || null;
	} catch (err) {
		logError('ai.fixNote', err);
		return null;
	}
}
