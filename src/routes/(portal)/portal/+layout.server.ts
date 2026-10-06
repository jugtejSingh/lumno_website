import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { therapist, user } from '$lib/server/db/schema';
import { markPastAppointmentsCompleted } from '$lib/server/appointments';

// Shared by every /portal/* page, so each page's own load only fetches its section.
export const load: LayoutServerLoad = async (event) => {
	const { client } = await event.parent();
	await markPastAppointmentsCompleted(client.therapistId);

	const [therapistRow] = await db
		.select({ name: user.name, timezone: therapist.timezone, currency: therapist.currency })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(therapist.id, client.therapistId));

	const therapistTimezone = therapistRow?.timezone ?? 'Asia/Kolkata';

	return {
		therapistName: therapistRow?.name ?? 'your practitioner',
		therapistTimezone,
		// only display formatting (session list, invoice/notes dates) uses this — booking
		// and availability always stay on the therapist's own timezone
		displayTimezone: client.timezone ?? therapistTimezone,
		currency: therapistRow?.currency ?? 'INR'
	};
};
