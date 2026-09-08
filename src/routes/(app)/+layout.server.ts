import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { therapist } from '$lib/server/db/schema';

// Auth + therapist gate lives in hooks.server.ts (covers endpoints too), so
// locals.user / locals.therapistId are guaranteed here.
export const load: LayoutServerLoad = async (event) => {
	const [therapistRow] = await db
		.select()
		.from(therapist)
		.where(eq(therapist.id, event.locals.therapistId!));

	return { user: event.locals.user!, therapist: therapistRow };
};
