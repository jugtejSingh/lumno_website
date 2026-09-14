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
				// pinned by hand, not `sort: 'price'` — that ties Relace (same $0.15/$0.60 price,
				// but 4.2s latency/22 tps) with DeepSeek's own endpoint (1.18s/120 tps) and can land
				// on either. DeepSeek's endpoint is cheapest-or-tied AND fastest, so it goes first;
				// Novita and Baseten are the next-best cost/speed combo if it's ever down.
				provider: { order: ['DeepSeek', 'Novita', 'Baseten'], allow_fallbacks: true },
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: body }
				]
			})
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
