import type { Actions, PageServerLoad } from './$types';
import { listClientsWithNotes } from '$lib/server/notes';
import { listPastAppointmentsForClient } from '$lib/server/appointments';
import { listClients } from '$lib/server/clients';
import { noteActions } from '$lib/server/noteActions';

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
	...noteActions()
};
