import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { therapist } from '$lib/server/db/schema';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	if (!event.locals.therapistId) {
		return redirect(302, '/portal');
	}

	const [therapistRow] = await db
		.select()
		.from(therapist)
		.where(eq(therapist.id, event.locals.therapistId));

	return { user: event.locals.user, therapist: therapistRow };
};