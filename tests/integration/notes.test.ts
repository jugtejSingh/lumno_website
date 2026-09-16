import { describe, it, expect, beforeEach } from 'vitest';
import { createNote, updateNote, listSharedNotesForClient } from '$lib/server/notes';
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
	const res = await createNote(therapistId, clientId, 'private', '# heading', null, null);
	expect(res).toMatchObject({ note: { body: '# heading', visibility: 'private' } });
});

it('rejects a note for a client of another therapist', async () => {
	const other = await mkTherapist();
	expect(await createNote(other.id, clientId, 'private', 'x', null, null)).toEqual({ error: 'not_found' });
});

it('rejects an appointmentId that is not this client’s', async () => {
	const otherClient = await mkClient(therapistId);
	const appt = await mkAppointment(therapistId, otherClient.id);
	expect(await createNote(therapistId, clientId, 'private', 'x', appt.id, null)).toEqual({
		error: 'not_found'
	});
});

describe('editing', () => {
	it('rewrites body and description', async () => {
		const { note } = await createNote(therapistId, clientId, 'private', 'first draft', null, 'old');
		const res = await updateNote(therapistId, note!.id, 'second draft', null, 'new');
		expect(res).toMatchObject({ note: { body: 'second draft', description: 'new' } });
	});

	it('rejects editing another therapist’s note', async () => {
		const { note } = await createNote(therapistId, clientId, 'private', 'mine', null, null);
		const other = await mkTherapist();
		expect(await updateNote(other.id, note!.id, 'hijacked', null, null)).toEqual({
			error: 'not_found'
		});
	});

	it('rejects an appointmentId that is not this note’s client', async () => {
		const { note } = await createNote(therapistId, clientId, 'private', 'mine', null, null);
		const otherClient = await mkClient(therapistId);
		const appt = await mkAppointment(therapistId, otherClient.id);
		expect(await updateNote(therapistId, note!.id, 'mine', appt.id, null)).toEqual({
			error: 'not_found'
		});
	});
});

describe('portal visibility', () => {
	it('only shared notes reach the client portal', async () => {
		await createNote(therapistId, clientId, 'private', 'therapist eyes only', null, null);
		await createNote(therapistId, clientId, 'shared', 'see you next week', null, null);

		const shared = await listSharedNotesForClient(clientId, 1, 5);
		expect(shared.rows.map((n) => n.body)).toEqual(['see you next week']);
	});

	it('paginates shared notes newest first', async () => {
		for (let i = 0; i < 7; i++) {
			await createNote(therapistId, clientId, 'shared', `note ${i}`, null, null);
		}
		const page1 = await listSharedNotesForClient(clientId, 1, 5);
		expect(page1.rows).toHaveLength(5);
		expect(page1.total).toBe(7);
		expect(page1.rows[0].body).toBe('note 6');

		const page2 = await listSharedNotesForClient(clientId, 2, 5);
		expect(page2.rows).toHaveLength(2);
	});
});
