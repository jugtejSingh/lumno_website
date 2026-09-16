import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listClientsWithNotes, createNote, updateNote, type NoteVisibility } from '$lib/server/notes';
import { listPastAppointmentsForClient } from '$lib/server/appointments';
import { listClients } from '$lib/server/clients';
import { fixNoteText, summarizeNoteText, isOverAiBudget } from '$lib/server/ai';

const AI_LIMIT_MESSAGE = 'Monthly AI limit reached for this account. It resets next month.';

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
	}
};