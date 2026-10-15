import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { destinationForRole } from '$lib/server/destination';
import { createTherapistProfile } from '$lib/server/therapistProfile';

export const load: PageServerLoad = async (event) => {
	// Fail safe: only an exact 'Therapist' round-trips into provisioning a therapist
	// profile below. A missing/mangled/replayed param defaults to Client, which never
	// auto-creates anything (see signInGoogleAction in $lib/server/loginActions).
	let role: 'Therapist' | 'Client';
	if (event.url.searchParams.get('role') === 'Therapist') {
		role = 'Therapist';
	} else {
		role = 'Client';
	}

	if (!event.locals.user) {
		if (role === 'Client') {
			return redirect(302, '/login/client');
		}
		return redirect(302, '/login');
	}

	const destination = await destinationForRole(event.locals.user.id, role);
	if (destination) {
		return redirect(302, destination);
	}

	if (role === 'Client') {
		// signed in fine, but nobody has invited this Google account as a client —
		// drop the session, or /login/client would wave it through as a therapist
		await auth.api.signOut({ headers: event.request.headers });
		return redirect(302, '/login/client?error=no_client_profile');
	}

	// First time signing in with Google: provision a therapist profile, same as email sign-up.
	await createTherapistProfile(event.locals.user.id, {
		photoUrl: event.locals.user.image ?? null
	});

	return redirect(302, '/dashboard');
};
