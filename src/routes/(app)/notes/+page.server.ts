import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listClientsWithNotes, createNote, type NoteVisibility } from '$lib/server/notes';
import { listPastAppointmentsForClient } from '$lib/server/appointments';
import { listClients } from '$lib/server/clients';

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

		if (!clientId || !body) {
			return fail(400, { message: 'Write something before saving' });
		}

		const result = await createNote(therapistId, clientId, visibility, body, appointmentId);
		if (result.error) {
			return fail(400, { message: 'Could not save that note' });
		}
	}
};