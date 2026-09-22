import { env } from '$env/dynamic/private';
import { logError } from '$lib/server/log';
import { db } from '$lib/server/db';
import { aiUsage } from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';

const MONTHLY_TOKEN_CAP = 2_000_000;

function currentYearMonth(): string {
	return new Date().toISOString().slice(0, 7); // '2026-09'
}

export async function isOverAiBudget(therapistId: string): Promise<boolean> {
	const [row] = await db
		.select({ tokensUsed: aiUsage.tokensUsed })
		.from(aiUsage)
		.where(and(eq(aiUsage.therapistId, therapistId), eq(aiUsage.yearMonth, currentYearMonth())));
	return (row?.tokensUsed ?? 0) >= MONTHLY_TOKEN_CAP;
}

async function recordTokenUsage(therapistId: string, tokens: number) {
	if (!tokens) return;
	await db
		.insert(aiUsage)
		.values({ therapistId, yearMonth: currentYearMonth(), tokensUsed: tokens })
		.onConflictDoUpdate({
			target: [aiUsage.therapistId, aiUsage.yearMonth],
			set: { tokensUsed: sql`${aiUsage.tokensUsed} + ${tokens}` }
		});
}

async function callOpenRouter(
	label: string,
	systemPrompt: string,
	therapistId: string,
	messages: { role: 'user' | 'assistant'; content: string }[],
	jsonMode = false
): Promise<string | null> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		logError(label, new Error('OPENROUTER_API_KEY not set'));
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
				// prompts. DeepSeek's own endpoint isn't ZDR, so it's out; Wafer, Novita and Baseten
				// are (Wafer confirmed directly, Novita/Baseten checked against
				// openrouter.ai/api/v1/endpoints/zdr, 2026-09). If all three are down the request
				// fails rather than falling back to a non-ZDR provider.
				provider: {
					order: ['Wafer', 'Novita', 'Baseten'],
					allow_fallbacks: true,
					zdr: true,
					data_collection: 'deny'
				},
				messages: [{ role: 'system', content: systemPrompt }, ...messages],
				...(jsonMode ? { response_format: { type: 'json_object' } } : {})
			}),
			// don't hold the request open forever if the provider hangs
			signal: AbortSignal.timeout(30_000)
		});
		if (!res.ok) {
			logError(label, new Error(`OpenRouter responded ${res.status}`), { status: res.status });
			return null;
		}
		const data = await res.json();
		await recordTokenUsage(therapistId, data.usage?.total_tokens ?? 0);
		const text = data.choices?.[0]?.message?.content?.trim();
		return text || null;
	} catch (err) {
		logError(label, err);
		return null;
	}
}

// Only ever fixes up wording already in the note — never invents new clinical
// content. Kept to grammar/clarity/flow so a therapist can trust the output
// without re-reading every sentence against the original.
const FIX_SYSTEM_PROMPT =
	"You clean up a therapist's session note. Fix grammar, spelling, and punctuation, and improve clarity and flow. You may elaborate on what's already written to make it read more naturally, but never invent new facts, symptoms, events, or details that aren't already in the note — only work with what's given. Reply with only the fixed note text, no preamble or commentary.";

const DESCRIBE_SYSTEM_PROMPT =
	"Summarize a therapist's session note in one short plain-text sentence (under 15 words) so it can label a collapsed card in a list. Never invent facts not already in the note. Reply with only the sentence, no preamble or commentary.";

export async function fixNoteText(therapistId: string, body: string): Promise<string | null> {
	return callOpenRouter('ai.fixNote', FIX_SYSTEM_PROMPT, therapistId, [{ role: 'user', content: body }]);
}

export async function summarizeNoteText(therapistId: string, body: string): Promise<string | null> {
	return callOpenRouter('ai.describeNote', DESCRIBE_SYSTEM_PROMPT, therapistId, [
		{ role: 'user', content: body }
	]);
}

// The private note is clinical data. What goes back to the client is only the
// overarching topics and any homework — no observations about them, no
// diagnostic language, no quotes, nothing the therapist wrote *about* them.
const SHARE_SYSTEM_PROMPT = `You turn a therapist's private session note into a short message the CLIENT will read in their portal.

Include only:
- the main topics the session covered, named warmly and at a high level
- any homework, exercises, or practices to do before next time

Never include: clinical observations, assessments, diagnoses, risk notes, the therapist's impressions of the client, direct quotes, or any sensitive personal detail from the note. When in doubt, leave it out. Never invent anything that is not in the note. Write to the client as "you", in plain, warm language. Markdown is allowed for a short homework list.

Reply with only a JSON object, no preamble:
{"description": "one plain-text sentence under 15 words labelling the message", "body": "the message to the client"}`;

export async function summarizeNoteForClient(
	therapistId: string,
	body: string
): Promise<{ description: string; body: string } | null> {
	const raw = await callOpenRouter(
		'ai.shareNote',
		SHARE_SYSTEM_PROMPT,
		therapistId,
		[{ role: 'user', content: body }],
		true
	);
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed.body !== 'string' || !parsed.body.trim()) {
			return null;
		}
		let description = '';
		if (typeof parsed.description === 'string') {
			description = parsed.description.trim();
		}
		return { description, body: parsed.body.trim() };
	} catch (err) {
		logError('ai.shareNote', err);
		return null;
	}
}

const CHAT_SYSTEM_PROMPT_PREFIX = `You help a therapist think through a specific client's case using only their private session notes, given below. Answer the therapist's questions about this client based on the notes. Never invent facts not in the notes — say so if the notes don't cover something asked. Markdown is allowed in your replies (lists, bold, headings).

--- PRIVATE NOTES ---
`;

export async function chatAboutClient(
	therapistId: string,
	notesContext: string,
	history: { role: 'user' | 'assistant'; content: string }[],
	question: string
): Promise<string | null> {
	const systemPrompt = CHAT_SYSTEM_PROMPT_PREFIX + notesContext;
	return callOpenRouter('ai.chatAboutClient', systemPrompt, therapistId, [
		...history,
		{ role: 'user', content: question }
	]);
}
