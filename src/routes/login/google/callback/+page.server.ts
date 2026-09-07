import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { destinationFor } from '$lib/server/destination';
import { createTherapistProfile } from '$lib/server/therapistProfile';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	const destination = await destinationFor(event.locals.user.id);
	if (destination) {
		return redirect(302, destination);
	}

	// First time signing in with Google: provision a therapist profile, same as email sign-up.
	await createTherapistProfile(event.locals.user.id, {
		photoUrl: event.locals.user.image ?? null
	});

	return redirect(302, '/dashboard');
};
