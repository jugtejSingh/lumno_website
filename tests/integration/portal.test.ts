import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { appointment, client } from '$lib/server/db/schema';
import { replaceWeekTemplate, type DesignedDay, type DesignedSlot } from '$lib/server/availabilitySlots';
import { load as layoutLoad } from '../../src/routes/(portal)/+layout.server';
import { load as pageLoad, actions } from '../../src/routes/(portal)/portal/+page.server';
import { resetDb, mkTherapist, mkClient, mkUser, mkAppointment, mkEvent } from './helpers';

// The client portal: what the layout ships to the browser, and the client's own actions.

let therapistId: string;
let clientUser: Awaited<ReturnType<typeof mkUser>>;
let clientId: string;

// 5 days out, inside the booking window; therapist in UTC
const target = new Date();
target.setUTCDate(target.getUTCDate() + 5);
const y = target.getUTCFullYear();
const m = target.getUTCMonth();
const d = target.getUTCDate();

function at(hour: number) {
	return new Date(Date.UTC(y, m, d, hour, 0, 0));
}

async function everyDay(slots: DesignedSlot[], maxSessions: number | null) {
	const week: DesignedDay[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		week.push({ slots, maxSessions });
	}
	await replaceWeekTemplate(therapistId, week);
}

const threeHourly: DesignedSlot[] = [
	{ startTime: '09:00', endTime: '10:00', modality: 'online' },
	{ startTime: '10:00', endTime: '11:00', modality: 'online' },
	{ startTime: '11:00', endTime: '12:00', modality: 'online' }
];

async function runLayout(locals: Record<string, unknown>) {
	return layoutLoad(mkEvent({ locals }) as never);
}

async function runPage(query: string) {
	const locals = { user: clientUser, clientId };
	const parentData = await runLayout(locals);
	const data = await pageLoad(
		mkEvent({ locals, url: `http://localhost/portal?${query}`, parent: async () => parentData }) as never
	);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- load's return is void | PageData
	return data as Record<string, any>;
}

function post(action: keyof typeof actions, fields: Record<string, string>, asClientId: string | null = clientId) {
	return actions[action](mkEvent({ locals: { user: clientUser, clientId: asClientId }, fields }) as never);
}

async function statusOf(id: string) {
	const [row] = await db.select({ status: appointment.status }).from(appointment).where(eq(appointment.id, id));
	return row.status;
}

const validProfile = {
	dateOfBirth: '1990-04-12',
	gender: 'Female',
	city: 'Pune',
	state: 'Maharashtra',
	country: 'in'
};

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ timezone: 'UTC' })).id;
	clientUser = await mkUser();
	clientId = (
		await mkClient(therapistId, {
			userId: clientUser.id,
			customFields: { h1: 'therapist-only note' },
			tags: ['private-tag'],
			rate: 2500,
			phone: '+919876543210'
		})
	).id;
});

describe('portal layout', () => {
	it('redirects to /login without a user', async () => {
		try {
			await runLayout({});
			throw new Error('expected a redirect');
		} catch (err) {
			expect(isRedirect(err)).toBe(true);
			expect((err as { location: string }).location).toBe('/login');
		}
	});

	it('redirects to /dashboard for a user who is not a client', async () => {
		try {
			await runLayout({ user: clientUser, clientId: null });
			throw new Error('expected a redirect');
		} catch (err) {
			expect(isRedirect(err)).toBe(true);
			expect((err as { location: string }).location).toBe('/dashboard');
		}
	});

	it('ships exactly the allow-listed client fields — no notes, tags or rate', async () => {
		const data = (await runLayout({ user: clientUser, clientId })) as { client: Record<string, unknown> };
		expect(Object.keys(data.client).sort()).toEqual(
			['city', 'country', 'dateOfBirth', 'gender', 'id', 'name', 'phone', 'state', 'therapistId'].sort()
		);
		const serialized = JSON.stringify(data);
		expect(serialized).not.toContain('therapist-only note');
		expect(serialized).not.toContain('private-tag');
		expect(serialized).not.toContain('2500');
	});

	it('only lists client profiles for switching when there is more than one', async () => {
		const single = (await runLayout({ user: clientUser, clientId })) as { clients: unknown[] };
		expect(single.clients).toEqual([]);

		const otherTherapist = await mkTherapist({ timezone: 'UTC' });
		await mkClient(otherTherapist.id, { userId: clientUser.id });
		const double = (await runLayout({ user: clientUser, clientId })) as { clients: unknown[] };
		expect(double.clients).toHaveLength(2);
	});
});

describe('portal load', () => {
	it('flags an incomplete profile and passes the profile through blank', async () => {
		const data = await runPage(`year=${y}&month=${m}`);
		expect(data.profileComplete).toBe(false);
		expect(data.clientProfile).toEqual({ dateOfBirth: '', gender: '', city: '', state: '', country: '' });
	});

	it('does not leak therapist-only fields in page data either', async () => {
		const serialized = JSON.stringify(await runPage(`year=${y}&month=${m}`));
		expect(serialized).not.toContain('therapist-only note');
		expect(serialized).not.toContain('private-tag');
	});

	describe('?reschedule on a full day', () => {
		// cap 2: the client's own 09:00 plus someone else's 11:00 fill the day
		let ownId: string;
		let otherId: string;

		beforeEach(async () => {
			await everyDay(threeHourly, 2);
			ownId = (await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10) })).id;
			const otherClient = await mkClient(therapistId, { name: 'Other Client' });
			otherId = (await mkAppointment(therapistId, otherClient.id, { startAt: at(11), endAt: at(12) })).id;
		});

		it('without the param the day shows as full', async () => {
			const data = await runPage(`year=${y}&month=${m}`);
			expect(data.rescheduleId).toBeNull();
			expect(data.slotsByDay[d]).toBeUndefined();
		});

		it('the client’s own upcoming session is left out of the count', async () => {
			const data = await runPage(`year=${y}&month=${m}&reschedule=${ownId}`);
			expect(data.rescheduleId).toBe(ownId);
			expect(data.slotsByDay[d]).toBeDefined();
		});

		it('another client’s session id is ignored', async () => {
			const data = await runPage(`year=${y}&month=${m}&reschedule=${otherId}`);
			expect(data.rescheduleId).toBeNull();
			expect(data.slotsByDay[d]).toBeUndefined();
		});

		it('a made-up id is ignored', async () => {
			const data = await runPage(`year=${y}&month=${m}&reschedule=nope`);
			expect(data.rescheduleId).toBeNull();
			expect(data.slotsByDay[d]).toBeUndefined();
		});
	});
});

describe('saveProfile', () => {
	it('refuses a signed-in user who is not a client', async () => {
		const result = await post('saveProfile', validProfile, null);
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(403);
	});

	it('returns the validation message and writes nothing on a bad profile', async () => {
		const result = await post('saveProfile', { ...validProfile, city: '' });
		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: unknown }).data).toEqual({ profileMessage: 'Enter your city or town.' });
		const [row] = await db.select().from(client).where(eq(client.id, clientId));
		expect(row.gender).toBeNull();
	});

	it('saves a valid profile to the signed-in client, upper-casing the country', async () => {
		expect(isActionFailure(await post('saveProfile', validProfile))).toBe(false);
		const [row] = await db.select().from(client).where(eq(client.id, clientId));
		expect(row).toMatchObject({ ...validProfile, country: 'IN' });

		const data = await runPage(`year=${y}&month=${m}`);
		expect(data.profileComplete).toBe(true);
	});
});

describe('cancelSession', () => {
	it('cancels the client’s own session', async () => {
		const own = await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10) });
		expect(isActionFailure(await post('cancelSession', { appointmentId: own.id }))).toBe(false);
		expect(await statusOf(own.id)).toBe('cancelled');
	});

	it('cannot cancel another client’s session with the same therapist', async () => {
		const otherClient = await mkClient(therapistId, { name: 'Other Client' });
		const theirs = await mkAppointment(therapistId, otherClient.id, { startAt: at(9), endAt: at(10) });
		const result = await post('cancelSession', { appointmentId: theirs.id });
		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: unknown }).data).toEqual({ message: 'That session could not be found' });
		expect(await statusOf(theirs.id)).toBe('confirmed');
	});

	it('refuses without a client', async () => {
		const own = await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10) });
		const result = await post('cancelSession', { appointmentId: own.id }, null);
		expect((result as { status: number }).status).toBe(401);
		expect(await statusOf(own.id)).toBe('confirmed');
	});
});

describe('rescheduleSession', () => {
	const dateFields = { year: String(y), month: String(m), day: String(d) };

	it('moves the client’s own session to an open slot', async () => {
		await everyDay(threeHourly, null);
		const own = await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10) });
		const result = await post('rescheduleSession', { ...dateFields, appointmentId: own.id, startTime: '11:00' });
		expect(isActionFailure(result)).toBe(false);
		expect(await statusOf(own.id)).toBe('rescheduled');
	});

	it('cannot move another client’s session', async () => {
		await everyDay(threeHourly, null);
		const otherClient = await mkClient(therapistId, { name: 'Other Client' });
		const theirs = await mkAppointment(therapistId, otherClient.id, { startAt: at(9), endAt: at(10) });
		const result = await post('rescheduleSession', { ...dateFields, appointmentId: theirs.id, startTime: '11:00' });
		expect((result as { data: unknown }).data).toEqual({ message: 'That session could not be found' });
		expect(await statusOf(theirs.id)).toBe('confirmed');
	});

	it('rejects a missing session id, date or time', async () => {
		const own = await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10) });
		expect(
			((await post('rescheduleSession', { ...dateFields, startTime: '11:00' })) as { data: unknown }).data
		).toEqual({ message: 'That session could not be found' });
		expect(
			((await post('rescheduleSession', { appointmentId: own.id, startTime: '11:00' })) as { data: unknown }).data
		).toEqual({ message: 'Pick a day and a time slot' });
		expect(
			((await post('rescheduleSession', { ...dateFields, appointmentId: own.id, startTime: '25:00' })) as { data: unknown })
				.data
		).toEqual({ message: 'Pick a day and a time slot' });
	});

	it('rejects a time that is not an open slot', async () => {
		await everyDay(threeHourly, null);
		const own = await mkAppointment(therapistId, clientId, { startAt: at(9), endAt: at(10) });
		const result = await post('rescheduleSession', { ...dateFields, appointmentId: own.id, startTime: '15:00' });
		expect((result as { data: unknown }).data).toEqual({ message: 'That time is no longer available' });
		expect(await statusOf(own.id)).toBe('confirmed');
	});
});
