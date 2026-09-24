import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { destinationForRole } from '$lib/server/destination';
import { createTherapistProfile } from '$lib/server/therapistProfile';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	// Fail safe: only an exact 'Therapist' round-trips into provisioning a therapist
	// profile below. A missing/mangled/replayed param defaults to Client, which never
	// auto-creates anything (see the signInGoogle comment this mirrors).
	let role: 'Therapist' | 'Client';
	if (event.url.searchParams.get('role') === 'Therapist') {
		role = 'Therapist';
	} else {
		role = 'Client';
	}

	const destination = await destinationForRole(event.locals.user.id, role);
	if (destination) {
		return redirect(302, destination);
	}

	if (role === 'Client') {
		// signed in fine, but nobody has invited this Google account as a client
		return redirect(302, '/login?error=no_client_profile');
	}

	// First time signing in with Google: provision a therapist profile, same as email sign-up.
	await createTherapistProfile(event.locals.user.id, {
		photoUrl: event.locals.user.image ?? null
	});

	return redirect(302, '/dashboard');
};
