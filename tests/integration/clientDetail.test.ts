import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { client, payment } from '$lib/server/db/schema';
import { getClient, setClientTimezone } from '$lib/server/clients';
import { createAppointmentForTherapist } from '$lib/server/appointments';
import { listClientsWithNotes } from '$lib/server/notes';
import { load, actions } from '../../src/routes/(app)/clients/[clientId]/+page.server';
import { resetDb, mkTherapist, mkClient, mkUser, mkPayment, mkAppointment, mkEvent } from './helpers';

// The single-client page: its load, and the therapist's actions on that client.

let therapist: Awaited<ReturnType<typeof mkTherapist>>;
let clientId: string;

type ActionName = keyof typeof actions;

function post(
	action: ActionName,
	fields: Record<string, string> = {},
	opts: { asTherapistId?: string; onClient?: string } = {}
) {
	const event = mkEvent({
		locals: { therapistId: opts.asTherapistId ?? therapist.id },
		params: { clientId: opts.onClient ?? clientId },
		fields
	});
	return (actions[action] as (e: never) => Promise<unknown>)(event as never);
}

function failure(result: unknown) {
	if (!isActionFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result)}`);
	}
	return { status: result.status, data: result.data as unknown as Record<string, unknown> };
}

async function rowOf(id: string) {
	const [row] = await db.select().from(client).where(eq(client.id, id));
	return row;
}

beforeEach(async () => {
	await resetDb();
	therapist = await mkTherapist({ timezone: 'UTC' });
	clientId = (await mkClient(therapist.id, { name: 'Sam Client', email: 'sam@example.com' })).id;
});

describe('getClient / setClientTimezone', () => {
	it('getClient returns the therapist’s own client', async () => {
		expect((await getClient(therapist.id, clientId))!.name).toBe('Sam Client');
	});

	it('getClient is null for another therapist’s client and for an unknown id', async () => {
		const other = await mkTherapist();
		expect(await getClient(other.id, clientId)).toBeNull();
		expect(await getClient(therapist.id, 'nope')).toBeNull();
	});

	it('setClientTimezone sets and clears the client’s timezone', async () => {
		await setClientTimezone(clientId, 'Europe/London');
		expect((await rowOf(clientId)).timezone).toBe('Europe/London');
		await setClientTimezone(clientId, null);
		expect((await rowOf(clientId)).timezone).toBeNull();
	});
});

describe('lastSessionAt on booking', () => {
	function book(day: number) {
		return createAppointmentForTherapist(therapist.id, {
			clientId,
			year: 2030,
			month: 5,
			day,
			startHour: 9,
			startMinute: 0,
			endHour: 10,
			endMinute: 0,
			modality: 'online'
		});
	}

	it('is set to the booking’s start when the client had none', async () => {
		await book(10);
		expect((await rowOf(clientId)).lastSessionAt!.toISOString()).toBe('2030-06-10T09:00:00.000Z');
	});

	it('keeps the later date when an earlier session is booked afterwards', async () => {
		await book(20);
		await book(10);
		expect((await rowOf(clientId)).lastSessionAt!.toISOString()).toBe('2030-06-20T09:00:00.000Z');
	});

	it('moves forward when a later session is booked', async () => {
		await book(10);
		await book(20);
		expect((await rowOf(clientId)).lastSessionAt!.toISOString()).toBe('2030-06-20T09:00:00.000Z');
	});
});

describe('load', () => {
	async function run(id = clientId, t = therapist) {
		const event = mkEvent({ params: { clientId: id }, parent: async () => ({ therapist: t }) });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- load's return is void | PageData
		return (await load(event as never)) as Record<string, any>;
	}

	it('returns the client, their roster and currency', async () => {
		await mkClient(therapist.id, { name: 'Other Person' });
		const data = await run();
		expect(data.client.id).toBe(clientId);
		expect(data.clients).toHaveLength(2);
		expect(data.currency).toBe(therapist.currency);
		expect(data.notes).toEqual([]);
		expect(data.sharedNotes).toEqual([]);
	});

	it('lists this client’s sessions', async () => {
		await mkAppointment(therapist.id, clientId, { startAt: new Date(Date.now() + 86_400_000) });
		await mkAppointment(therapist.id, clientId, { startAt: new Date(Date.now() - 86_400_000 * 3) });
		const data = await run();
		expect(data.upcomingSessions).toHaveLength(1);
		expect(data.pastSessions).toHaveLength(1);
	});

	it('404s for another therapist’s client', async () => {
		const other = await mkTherapist();
		await expect(run(clientId, other)).rejects.toMatchObject({ status: 404 });
	});
});

describe('update action', () => {
	const valid = { name: 'Sam Renamed', status: 'paused', rate: '1500', tags: ' a, b ,,c ' };

	it('saves name, rate, tags and status', async () => {
		expect(isActionFailure(await post('update', valid))).toBe(false);
		const row = await rowOf(clientId);
		expect(row).toMatchObject({ name: 'Sam Renamed', status: 'paused', rate: 1500, tags: ['a', 'b', 'c'] });
	});

	it('a blank rate clears it', async () => {
		await post('update', { ...valid, rate: '' });
		expect((await rowOf(clientId)).rate).toBeNull();
	});

	it('requires a first and last name', async () => {
		const result = failure(await post('update', { ...valid, name: 'Sam' }));
		expect(result.status).toBe(400);
		expect(result.data).toEqual({ fieldErrors: { name: 'Please enter their first and last name.' } });
		expect((await rowOf(clientId)).name).toBe('Sam Client');
	});

	it('rejects an unknown status', async () => {
		expect(failure(await post('update', { ...valid, status: 'gone' }))).toEqual({
			status: 400,
			data: { message: 'Invalid status' }
		});
	});

	it('cannot update another therapist’s client', async () => {
		const other = await mkTherapist();
		expect(failure(await post('update', valid, { asTherapistId: other.id })).data).toEqual({
			message: 'Client not found'
		});
		expect((await rowOf(clientId)).name).toBe('Sam Client');
	});
});

describe('delete action', () => {
	it('deletes the client and redirects to the list', async () => {
		try {
			await post('delete');
			throw new Error('expected a redirect');
		} catch (err) {
			expect(isRedirect(err)).toBe(true);
			expect((err as { location: string }).location).toBe('/clients');
		}
		expect(await getClient(therapist.id, clientId)).toBeNull();
	});

	it('another therapist cannot delete the client', async () => {
		const other = await mkTherapist();
		try {
			await post('delete', {}, { asTherapistId: other.id });
		} catch {
			// it redirects either way; the client must survive
		}
		expect(await getClient(therapist.id, clientId)).not.toBeNull();
	});
});

describe('resendInvite action', () => {
	it('returns a fresh invite link', async () => {
		const result = (await post('resendInvite')) as { inviteUrl: string; message?: string };
		expect(result.inviteUrl).toContain('/');
		expect(result.message).toBeUndefined();
	});

	it('fails for a client with no email', async () => {
		const noEmail = await mkClient(therapist.id, { name: 'No Email' });
		expect(failure(await post('resendInvite', {}, { onClient: noEmail.id })).data).toEqual({
			message: 'This client has no email on file'
		});
	});

	it('fails for a client who already joined', async () => {
		const u = await mkUser();
		const joined = await mkClient(therapist.id, { name: 'Joined Person', email: 'j@example.com', userId: u.id });
		expect(failure(await post('resendInvite', {}, { onClient: joined.id })).data).toEqual({
			message: 'This client already has portal access'
		});
	});

	it('fails for another therapist’s client', async () => {
		const other = await mkTherapist();
		expect(failure(await post('resendInvite', {}, { asTherapistId: other.id })).data).toEqual({
			message: 'Client not found'
		});
	});
});

describe('payment actions', () => {
	async function paymentsOf(id: string) {
		return db.select().from(payment).where(eq(payment.clientId, id));
	}

	it('addCharge adds an unpaid charge for this client', async () => {
		expect(isActionFailure(await post('addCharge', { amount: '800', note: ' late fee ' }))).toBe(false);
		const rows = await paymentsOf(clientId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ amount: 800, status: 'unpaid', note: 'late fee' });
	});

	it('addCharge rejects a bad amount', async () => {
		for (const amount of ['', '0', '-5', 'abc']) {
			expect(failure(await post('addCharge', { amount })).data).toEqual({
				message: 'Enter an amount greater than 0'
			});
		}
		expect(await paymentsOf(clientId)).toEqual([]);
	});

	it('markPaid marks the payment paid', async () => {
		const p = await mkPayment(therapist.id, clientId, { status: 'unpaid' });
		await post('markPaid', { paymentId: p.id });
		expect((await paymentsOf(clientId))[0].status).toBe('paid');
	});

	it('markPaid / updatePayment / deletePayment 404 for an unknown payment', async () => {
		const expected = {
			message: 'That payment could not be found — it may have been deleted. Refresh and try again.'
		};
		expect(failure(await post('markPaid', { paymentId: 'nope' }))).toEqual({ status: 404, data: expected });
		expect(failure(await post('updatePayment', { paymentId: 'nope', amount: '5' }))).toEqual({
			status: 404,
			data: expected
		});
		expect(failure(await post('deletePayment', { paymentId: 'nope' }))).toEqual({ status: 404, data: expected });
	});

	it('updatePayment changes the amount and note, and rejects a bad amount', async () => {
		const p = await mkPayment(therapist.id, clientId, { amount: 500 });
		await post('updatePayment', { paymentId: p.id, amount: '900', note: 'fixed' });
		expect((await paymentsOf(clientId))[0]).toMatchObject({ amount: 900, note: 'fixed' });

		expect(failure(await post('updatePayment', { paymentId: p.id, amount: '0' })).status).toBe(400);
		expect((await paymentsOf(clientId))[0].amount).toBe(900);
	});

	it('deletePayment removes it, but not another therapist’s payment', async () => {
		const mine = await mkPayment(therapist.id, clientId);
		const other = await mkTherapist();
		const otherClient = await mkClient(other.id);
		const theirs = await mkPayment(other.id, otherClient.id);

		await post('deletePayment', { paymentId: mine.id });
		expect(await paymentsOf(clientId)).toEqual([]);

		expect(failure(await post('deletePayment', { paymentId: theirs.id })).status).toBe(404);
		expect(await paymentsOf(otherClient.id)).toHaveLength(1);
	});
});

describe('note actions on the client page', () => {
	async function notesOf() {
		const rows = await listClientsWithNotes(therapist.id, 'UTC');
		return rows.find((c) => c.id === clientId)!;
	}

	it('addNote saves a private note, and a shared one', async () => {
		await post('addNote', { clientId, body: '  private thought ', visibility: 'private' });
		await post('addNote', { clientId, body: 'for the client', visibility: 'shared' });

		const notes = await notesOf();
		expect(notes.notes).toHaveLength(1);
		expect(notes.sharedNotes).toHaveLength(1);
	});

	it('addNote needs a client and some text', async () => {
		expect(failure(await post('addNote', { clientId, body: '   ' }))).toEqual({
			status: 400,
			data: { message: 'Write something before saving' }
		});
		expect(failure(await post('addNote', { body: 'text' })).status).toBe(400);
	});

	it('addNote refuses another therapist’s client', async () => {
		const other = await mkTherapist();
		const result = failure(await post('addNote', { clientId, body: 'sneaky' }, { asTherapistId: other.id }));
		expect(result.data).toEqual({ message: 'Could not save that note' });
		expect((await notesOf()).notes).toEqual([]);
	});

	it('editNote changes the body, and needs text', async () => {
		await post('addNote', { clientId, body: 'first' });
		const noteId = (await notesOf()).notes[0].id;

		await post('editNote', { noteId, body: 'second' });
		expect((await notesOf()).notes[0].body).toBe('second');

		expect(failure(await post('editNote', { noteId, body: '' })).status).toBe(400);
	});

	it('editNote refuses another therapist’s note', async () => {
		await post('addNote', { clientId, body: 'mine' });
		const noteId = (await notesOf()).notes[0].id;
		const other = await mkTherapist();

		expect(failure(await post('editNote', { noteId, body: 'hijack' }, { asTherapistId: other.id })).status).toBe(400);
		expect((await notesOf()).notes[0].body).toBe('mine');
	});
});
