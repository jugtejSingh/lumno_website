import { redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { therapist } from '$lib/server/db/schema';
import { destinationFor } from '$lib/server/destination';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	const destination = await destinationFor(event.locals.user.id);
	if (destination) {
		return redirect(302, destination);
	}

	// First time signing in with Google: provision a therapist profile, same as email sign-up.
	await db.insert(therapist).values({
		userId: event.locals.user.id,
		slug: randomUUID(),
		photoUrl: event.locals.user.image ?? null
	});

	return redirect(302, '/dashboard');
};
