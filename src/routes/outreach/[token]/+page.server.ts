import { eq } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { therapist, user } from '$lib/server/db/schema';
import { parseMonthParam } from '$lib/server/dateParams';
import { parseDateParts, parseTimeParts } from '$lib/server/appointments';
import { listAvailabilityForMonth, createDiscoveryCall } from '$lib/server/availability';
import { findTherapistIdByOutreachToken } from '$lib/server/outreach';
import { parsePhone } from '$lib/phone';
import { isValidEmail } from '$lib/isValidEmail';

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 1000;

const bookErrorMessages = {
	unavailable: 'That time is no longer available',
	overlap: 'That time was just booked — pick another',
	modality_required: 'Choose online or in-person for that day',
	// the client-only rules; a discovery call never hits them, kept so BookSlotResult stays exhaustive
	balance_due: 'That time is no longer available',
	booking_limit: 'That time is no longer available',
	client_inactive: 'That time is no longer available'
} as const;

export const load: PageServerLoad = async ({ params, url }) => {
	const therapistId = await findTherapistIdByOutreachToken(params.token);
	if (!therapistId) {
		// off, unknown and expired look identical on purpose
		error(404, 'Page not found');
	}

	const [therapistRow] = await db
		.select({ name: user.name })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(therapist.id, therapistId));

	const now = new Date();
	const year = Number(url.searchParams.get('year')) || now.getFullYear();
	const month = parseMonthParam(url.searchParams.get('month'), now);

	return {
		therapistName: therapistRow?.name ?? 'your practitioner',
		year,
		month,
		slotsByDay: await listAvailabilityForMonth(therapistId, year, month)
	};
};

export const actions: Actions = {
	bookDiscoveryCall: async ({ params, request }) => {
		const therapistId = await findTherapistIdByOutreachToken(params.token);
		if (!therapistId) {
			return fail(404, { message: 'This booking link is no longer active' });
		}

		const formData = await request.formData();
		const date = parseDateParts(formData);
		const startTime = formData.get('startTime')?.toString() ?? '';
		if (!date || !parseTimeParts(startTime)) {
			return fail(400, { message: 'Pick a day and a time slot' });
		}

		const name = formData.get('name')?.toString().trim() ?? '';
		if (!name || name.length > MAX_NAME_LENGTH) {
			return fail(400, { message: 'Enter your name' });
		}
		const email = formData.get('email')?.toString().trim() ?? '';
		if (!isValidEmail(email) || email.length > MAX_EMAIL_LENGTH) {
			return fail(400, { message: 'Enter a valid email address' });
		}
		const parsedPhone = parsePhone(formData.get('phone')?.toString());
		if ('error' in parsedPhone) {
			return fail(400, { message: parsedPhone.error });
		}
		const message = formData.get('message')?.toString().trim() ?? '';
		if (message.length > MAX_MESSAGE_LENGTH) {
			return fail(400, { message: `Keep your message under ${MAX_MESSAGE_LENGTH} characters` });
		}

		const modalityRaw = formData.get('modality')?.toString();
		let modality: 'online' | 'in_person' | undefined;
		if (modalityRaw === 'online' || modalityRaw === 'in_person') {
			modality = modalityRaw;
		}

		const result = await createDiscoveryCall(therapistId, {
			year: date.year,
			month: date.month,
			day: date.day,
			startTime,
			modality,
			name,
			email,
			phone: parsedPhone.phone ?? '',
			message
		});
		if (result.error) {
			return fail(400, { message: bookErrorMessages[result.error] });
		}

		return { booked: true };
	}
};
