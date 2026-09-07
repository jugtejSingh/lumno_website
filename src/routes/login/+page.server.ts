import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { destinationFor, destinationForRole } from '$lib/server/destination';
import { requestTherapistUpgrade } from '$lib/server/therapistUpgrade';
import { createTherapistProfile } from '$lib/server/therapistProfile';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		const destination = await destinationFor(event.locals.user.id);
		if (destination) return redirect(302, destination);
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const role = formData.get('role')?.toString() === 'Client' ? 'Client' : 'Therapist';

		let userId: string;
		try {
			const result = await auth.api.signInEmail({
				body: { email, password },
				headers: event.request.headers,
				asResponse: false
			});
			userId = result.user.id;
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Login failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		const destination = await destinationForRole(userId, role);
		if (!destination) {
			return fail(
				403,
				role === 'Therapist'
					? { message: 'This account has no practice set up.' }
					: { message: 'This account has no client profile. Ask your therapist for an invite.' }
			);
		}
		return redirect(302, destination);
	},

	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';
		const photoUrl = formData.get('photoUrl')?.toString().trim() || null;
		const dateOfBirth = formData.get('dateOfBirth')?.toString().trim() || null;
		const bio = formData.get('bio')?.toString().trim() || null;
		const tags = (formData.get('tags')?.toString() ?? '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		if (!name.includes(' ')) {
			return fail(400, { message: 'Please enter your first and last name.' });
		}

		let userId: string;
		let emailVerified: boolean;
		try {
			const result = await auth.api.signUpEmail({
				body: { email, password, name, callbackURL: '/dashboard' },
				headers: event.request.headers,
				asResponse: false
			});
			userId = result.user.id;
			emailVerified = result.user.emailVerified;
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		try {
			await createTherapistProfile(userId, { photoUrl, dateOfBirth, bio, tags });
		} catch (error) {
			const cause = error instanceof Error ? error.cause : undefined;
			if (!(cause instanceof Error) || !('code' in cause) || cause.code !== '23503') {
				throw error;
			}
			// signUpEmail returned a synthetic, unpersisted user (see
			// $lib/server/therapistUpgrade.ts) — offer to attach a therapist
			// profile to the real existing account instead, without leaking
			// whether the email was actually taken.
			await requestTherapistUpgrade(email, name, event.url.origin);
			return redirect(302, '/login?checkEmail=1');
		}

		if (!emailVerified) {
			await auth.api.sendVerificationEmail({
				body: { email, callbackURL: '/dashboard' },
				headers: event.request.headers
			});
			return redirect(302, '/login?checkEmail=1');
		}
		return redirect(302, '/dashboard');
	},

	signInGoogle: async (event) => {
		let url: string;
		try {
			const result = await auth.api.signInSocial({
				body: { provider: 'google', callbackURL: '/login/google/callback' },
				headers: event.request.headers,
				asResponse: false
			});
			if (!result.url) {
				return fail(500, { message: 'Could not start Google sign-in' });
			}
			url = result.url;
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Google sign-in failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, url);
	}
};