import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { isActionFailure } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { appointment, client, therapistSettings } from '$lib/server/db/schema';
import type { WeeklyDay, DesignedSlot } from '$lib/server/availabilitySlots';
import { sendGuestBookingEmail } from '$lib/server/bookingEmails';
import {
	getOutreachState,
	generateOutreachLink,
	disableOutreach,
	findTherapistIdByOutreachToken
} from '$lib/server/outreach';
import {
	load as pageLoad,
	actions
} from '../../src/routes/outreach/[token]/+page.server';
import { resetDb, mkTherapist, mkSettings, mkWeek, mkEvent, mkAppointment, mkClient } from './helpers';

// The public discovery-call page: the link lifecycle, the load, and the booking action.

let therapistId: string;

// 5 days out, inside the booking window; therapist in UTC
const target = new Date();
target.setUTCDate(target.getUTCDate() + 5);
const y = target.getUTCFullYear();
const m = target.getUTCMonth();
const d = target.getUTCDate();

const slots: DesignedSlot[] = [
	{ startTime: '09:00', endTime: '10:00', modality: 'online' },
	{ startTime: '10:00', endTime: '11:00', modality: 'online' }
];

async function everyDay() {
	const week: WeeklyDay[] = [];
	for (let weekday = 0; weekday < 7; weekday++) {
		week.push({ slots, maxSessions: null, holiday: false });
	}
	await mkWeek(therapistId, week);
}

const goodFields = {
	year: String(y),
	month: String(m),
	day: String(d),
	startTime: '09:00',
	name: 'Sam Guest',
	email: 'sam@example.com',
	phone: '',
	message: 'Feeling anxious lately'
};

function book(token: string, fields: Record<string, string> = goodFields) {
	return actions.bookDiscoveryCall(mkEvent({ params: { token }, fields }) as never);
}

beforeEach(async () => {
	await resetDb();
	therapistId = (await mkTherapist({ timezone: 'UTC' })).id;
	await everyDay();
});

describe('outreach link', () => {
	it('is off until generated', async () => {
		expect(await getOutreachState(therapistId)).toEqual({ token: null, expiresAt: null });
	});

	it('generates a token that expires in about 7 days', async () => {
		const state = await generateOutreachLink(therapistId);
		expect(state.token).toBeTruthy();
		const days = (state.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
		expect(days).toBeGreaterThan(6.99);
		expect(days).toBeLessThanOrEqual(7);
		expect(await findTherapistIdByOutreachToken(state.token!)).toBe(therapistId);
	});

	it('regenerating kills the old link', async () => {
		const first = await generateOutreachLink(therapistId);
		const second = await generateOutreachLink(therapistId);
		expect(second.token).not.toBe(first.token);
		expect(await findTherapistIdByOutreachToken(first.token!)).toBeNull();
		expect(await findTherapistIdByOutreachToken(second.token!)).toBe(therapistId);
	});

	it('turning it off kills the link', async () => {
		const { token } = await generateOutreachLink(therapistId);
		await disableOutreach(therapistId);
		expect(await findTherapistIdByOutreachToken(token!)).toBeNull();
		expect(await getOutreachState(therapistId)).toEqual({ token: null, expiresAt: null });
	});

	it('an expired link stops working', async () => {
		const { token } = await generateOutreachLink(therapistId);
		await mkSettings(therapistId, { outreachExpiresAt: new Date(Date.now() - 1000) });
		expect(await findTherapistIdByOutreachToken(token!)).toBeNull();
		expect(await getOutreachState(therapistId)).toEqual({ token: null, expiresAt: null });
	});

	it('an empty or unknown token finds nothing', async () => {
		expect(await findTherapistIdByOutreachToken('')).toBeNull();
		expect(await findTherapistIdByOutreachToken('nope')).toBeNull();
	});
});

describe('outreach page load', () => {
	it('404s for an unknown, off or expired link', async () => {
		await expect(
			pageLoad(mkEvent({ params: { token: 'nope' } }) as never)
		).rejects.toMatchObject({ status: 404 });

		const { token } = await generateOutreachLink(therapistId);
		await mkSettings(therapistId, { outreachExpiresAt: new Date(Date.now() - 1000) });
		await expect(
			pageLoad(mkEvent({ params: { token: token! } }) as never)
		).rejects.toMatchObject({ status: 404 });
	});

	it('returns the open slots and the therapist name for a live link', async () => {
		const { token } = await generateOutreachLink(therapistId);
		const data = (await pageLoad(
			mkEvent({
				params: { token: token! },
				url: `http://localhost/outreach/${token}?year=${y}&month=${m}`
			}) as never
		)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
		expect(data.therapistName).toBeTruthy();
		expect(data.slotsByDay[d].map((s: { startTime: string }) => s.startTime)).toEqual(['09:00', '10:00']);
	});
});

describe('bookDiscoveryCall', () => {
	let token: string;

	beforeEach(async () => {
		token = (await generateOutreachLink(therapistId)).token!;
		(sendGuestBookingEmail as unknown as { mockClear: () => void }).mockClear();
	});

	it('books a guest appointment with their details in the notes, no client row', async () => {
		const result = await book(token);
		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ booked: true });

		const rows = await db.select().from(appointment).where(eq(appointment.therapistId, therapistId));
		expect(rows).toHaveLength(1);
		expect(rows[0].clientId).toBeNull();
		expect(rows[0].customName).toBe('Sam Guest');
		expect(rows[0].status).toBe('confirmed');
		expect(rows[0].startAt).toEqual(new Date(Date.UTC(y, m, d, 9, 0, 0)));
		expect(rows[0].notes).toContain('Email: sam@example.com');
		expect(rows[0].notes).toContain('Feeling anxious lately');
		expect(await db.select().from(client)).toHaveLength(0);
	});

	it('emails the guest the confirmation right away', async () => {
		await book(token);
		const [row] = await db.select().from(appointment).where(eq(appointment.therapistId, therapistId));
		expect(sendGuestBookingEmail).toHaveBeenCalledTimes(1);
		expect(sendGuestBookingEmail).toHaveBeenCalledWith(row.id, 'sam@example.com', 'discovery call');
	});

	it('stores an optional phone number in the notes', async () => {
		await book(token, { ...goodFields, phone: '+919876543210' });
		const [row] = await db.select().from(appointment);
		expect(row.notes).toContain('Phone: +919876543210');
	});

	it('rejects a dead link and books nothing', async () => {
		await disableOutreach(therapistId);
		const result = await book(token);
		expect(isActionFailure(result)).toBe(true);
		expect(await db.select().from(appointment)).toHaveLength(0);
		expect(sendGuestBookingEmail).not.toHaveBeenCalled();
	});

	it.each([
		['a missing name', { name: '  ' }],
		['a bad email', { email: 'not-an-email' }],
		['a bad phone', { phone: '12345' }],
		['an over-long message', { message: 'x'.repeat(1001) }],
		['no time picked', { startTime: '' }]
	])('rejects %s', async (_label, override) => {
		const result = await book(token, { ...goodFields, ...override });
		expect(isActionFailure(result)).toBe(true);
		expect(await db.select().from(appointment)).toHaveLength(0);
		expect(sendGuestBookingEmail).not.toHaveBeenCalled();
	});

	it('rejects a slot that is not open, and one that is already taken', async () => {
		const notASlot = await book(token, { ...goodFields, startTime: '14:00' });
		expect(isActionFailure(notASlot)).toBe(true);

		const other = await mkClient(therapistId);
		await mkAppointment(therapistId, other.id, {
			startAt: new Date(Date.UTC(y, m, d, 9, 0, 0)),
			endAt: new Date(Date.UTC(y, m, d, 10, 0, 0))
		});
		const taken = await book(token);
		expect(isActionFailure(taken)).toBe(true);
		expect(await db.select().from(appointment)).toHaveLength(1);
	});

	it('respects the minimum booking notice', async () => {
		// notice longer than the gap to the slot would need a same-day slot; use a huge notice instead
		await db
			.update(therapistSettings)
			.set({ minBookingNoticeHours: 24 * 6 })
			.where(eq(therapistSettings.therapistId, therapistId));
		const result = await book(token);
		expect(isActionFailure(result)).toBe(true);
		expect(await db.select().from(appointment)).toHaveLength(0);
	});
});
