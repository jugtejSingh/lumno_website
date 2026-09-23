import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	listClientsWithNotes,
	createNote,
	updateNote,
	privateNotesContext,
	type NoteVisibility
} from '$lib/server/notes';
import { listPastAppointmentsForClient } from '$lib/server/appointments';
import { listClients } from '$lib/server/clients';
import { fixNoteText, summarizeNoteText, summarizeNoteForClient, chatAboutClient, isOverAiBudget } from '$lib/server/ai';

const AI_LIMIT_MESSAGE = 'Monthly AI limit reached for this account. It resets next month.';
const CHAT_WORD_LIMIT = 1000;

function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}

function capWords(text: string, limit: number): string {
	const words = text.split(/\s+/).filter(Boolean);
	return words.length > limit ? words.slice(0, limit).join(' ') : text;
}

// Drops oldest turns first, keeping the most recent context, until the
// remaining history fits the given word budget.
function capHistoryWords(
	history: { role: 'user' | 'assistant'; content: string }[],
	limit: number
): { role: 'user' | 'assistant'; content: string }[] {
	const kept: { role: 'user' | 'assistant'; content: string }[] = [];
	let total = 0;
	for (let i = history.length - 1; i >= 0; i--) {
		const words = countWords(history[i].content);
		if (total + words > limit) {
			break;
		}
		kept.unshift(history[i]);
		total += words;
	}
	return kept;
}

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const [clientsWithNotes, allClients] = await Promise.all([
		listClientsWithNotes(therapist.id, therapist.timezone),
		listClients(therapist.id)
	]);

	const sessionsByClient: Record<string, { id: string; when: string }[]> = {};
	await Promise.all(
		allClients.map(async (c) => {
			sessionsByClient[c.id] = await listPastAppointmentsForClient(therapist.id, c.id, therapist.timezone);
		})
	);

	return { clients: clientsWithNotes, sessionsByClient };
};

export const actions: Actions = {
	addNote: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const visibility = formData.get('visibility')?.toString() === 'shared' ? 'shared' : ('private' as NoteVisibility);
		const body = formData.get('body')?.toString().trim() ?? '';
		const appointmentId = formData.get('appointmentId')?.toString() || null;
		const description = formData.get('description')?.toString().trim() || null;

		if (!clientId || !body) {
			return fail(400, { message: 'Write something before saving' });
		}

		const result = await createNote(therapistId, clientId, visibility, body, appointmentId, description);
		if (result.error) {
			return fail(400, { message: 'Could not save that note' });
		}
	},

	editNote: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const noteId = formData.get('noteId')?.toString() ?? '';
		const body = formData.get('body')?.toString().trim() ?? '';
		const appointmentId = formData.get('appointmentId')?.toString() || null;
		const description = formData.get('description')?.toString().trim() || null;

		if (!noteId || !body) {
			return fail(400, { message: 'Write something before saving' });
		}

		const result = await updateNote(therapistId, noteId, body, appointmentId, description);
		if (result.error) {
			return fail(400, { message: 'Could not save that note' });
		}
	},

	fixNote: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const body = formData.get('body')?.toString().trim() ?? '';
		if (!body) {
			return fail(400, { message: 'Write something before fixing it' });
		}
		if (await isOverAiBudget(therapistId)) {
			return fail(429, { message: AI_LIMIT_MESSAGE });
		}

		const fixed = await fixNoteText(therapistId, body);
		if (!fixed) {
			return fail(502, { message: 'Could not fix the note right now. Please try again.' });
		}
		return { fixed };
	},

	describeNote: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const body = formData.get('body')?.toString().trim() ?? '';
		if (!body) {
			return fail(400, { message: 'Write something before describing it' });
		}
		if (await isOverAiBudget(therapistId)) {
			return fail(429, { message: AI_LIMIT_MESSAGE });
		}

		const description = await summarizeNoteText(therapistId, body);
		if (!description) {
			return fail(502, { message: 'Could not describe the note right now. Please try again.' });
		}
		return { description };
	},

	// Drafts a client-safe version of a private note. Saves nothing — the
	// therapist reviews it in the editor and saves it as a shared note.
	shareNote: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const body = formData.get('body')?.toString().trim() ?? '';
		if (!body) {
			return fail(400, { message: 'Write something before sending it' });
		}
		if (await isOverAiBudget(therapistId)) {
			return fail(429, { message: AI_LIMIT_MESSAGE });
		}

		const shared = await summarizeNoteForClient(therapistId, body);
		if (!shared) {
			return fail(502, { message: 'Could not draft that for the client right now. Please try again.' });
		}
		return { shared };
	},

	// history is the prior turns of this chat, posted back each time — nothing is
	// stored server-side, so a page refresh starts the conversation over.
	chat: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const question = formData.get('question')?.toString().trim() ?? '';
		const historyRaw = formData.get('history')?.toString() ?? '[]';

		if (!clientId || !question) {
			return fail(400, { message: 'Ask something first' });
		}
		if (await isOverAiBudget(therapistId)) {
			return fail(429, { message: AI_LIMIT_MESSAGE });
		}

		let history: { role: 'user' | 'assistant'; content: string }[] = [];
		try {
			const parsed = JSON.parse(historyRaw);
			if (Array.isArray(parsed)) {
				history = parsed.filter(
					(m): m is { role: 'user' | 'assistant'; content: string } =>
						(m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
				);
			}
		} catch {
			// malformed history from the client just starts the chat over
		}

		const cappedQuestion = capWords(question, CHAT_WORD_LIMIT);
		history = capHistoryWords(history, CHAT_WORD_LIMIT - countWords(cappedQuestion));

		const notesContext = await privateNotesContext(therapistId, clientId);
		const answer = await chatAboutClient(therapistId, notesContext, history, cappedQuestion);
		if (!answer) {
			return fail(502, { message: 'Could not get an answer right now. Please try again.' });
		}
		return { answer };
	}
};