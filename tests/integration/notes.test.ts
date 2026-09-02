import { describe, it, expect, beforeEach } from 'vitest';
import { createNote, listSharedNotesForClient } from '$lib/server/notes';
import { resetDb, mkTherapist, mkClient, mkAppointment } from './helpers';

let therapistId: string;
let clientId: string;

beforeEach(async () => {
	await resetDb();
	const t = await mkTherapist();
	therapistId = t.id;
	clientId = (await mkClient(therapistId)).id;
});

it('creates a note for the therapist own client', async () => {
	const res = await createNote(therapistId, clientId, 'private', '# heading', null);
	expect(res).toMatchObject({ note: { body: '# heading', visibility: 'private' } });
});

it('rejects a note for a client of another therapist', async () => {
	const other = await mkTherapist();
	expect(await createNote(other.id, clientId, 'private', 'x', null)).toEqual({ error: 'not_found' });
});

it('rejects an appointmentId that is not this client’s', async () => {
	const otherClient = await mkClient(therapistId);
	const appt = await mkAppointment(therapistId, otherClient.id);
	expect(await createNote(therapistId, clientId, 'private', 'x', appt.id)).toEqual({
		error: 'not_found'
	});
});

describe('portal visibility', () => {
	it('only shared notes reach the client portal', async () => {
		await createNote(therapistId, clientId, 'private', 'therapist eyes only', null);
		await createNote(therapistId, clientId, 'shared', 'see you next week', null);

		const shared = await listSharedNotesForClient(clientId);
		expect(shared.map((n) => n.body)).toEqual(['see you next week']);
	});
});
