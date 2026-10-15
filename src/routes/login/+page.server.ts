import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { loadLoginPage, signInEmailAction, signInGoogleAction } from '$lib/server/loginActions';
import { requestTherapistUpgrade } from '$lib/server/therapistUpgrade';
import { createTherapistProfile } from '$lib/server/therapistProfile';
import { describeAuthError } from '$lib/server/authErrors';
import { logError } from '$lib/server/log';

export const load: PageServerLoad = loadLoginPage;

export const actions: Actions = {
	signInEmail: signInEmailAction('Therapist'),

	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';
		const dateOfBirth = formData.get('dateOfBirth')?.toString().trim() || null;
		const bio = formData.get('bio')?.toString().trim() || null;
		const tags = (formData.get('tags')?.toString() ?? '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		if (!email || !password) {
			return fail(400, { message: 'Enter an email and password.' });
		}
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
			const failure = describeAuthError(
				'login.signUp',
				error,
				'Registration failed. Please try again.'
			);
			return fail(failure.status, { message: failure.message });
		}

		try {
			await createTherapistProfile(userId, { dateOfBirth, bio, tags });
		} catch (error) {
			const cause = error instanceof Error ? error.cause : undefined;
			if (!(cause instanceof Error) || !('code' in cause) || cause.code !== '23503') {
				logError('login.signUp.profile', error, { userId });
				return fail(500, {
					message: 'Your account was created but the practice profile failed. Please log in and try again.'
				});
			}
			// signUpEmail returned a synthetic, unpersisted user (see
			// $lib/server/therapistUpgrade.ts) — offer to attach a therapist
			// profile to the real existing account instead, without leaking
			// whether the email was actually taken.
			try {
				await requestTherapistUpgrade(email, name, event.url.origin);
			} catch (upgradeError) {
				// Same redirect either way: revealing that the email failed would
				// reveal that the account exists.
				logError('login.signUp.upgradeEmail', upgradeError);
			}
			return redirect(302, '/login?checkEmail=1');
		}

		if (!emailVerified) {
			try {
				await auth.api.sendVerificationEmail({
					body: { email, callbackURL: '/dashboard' },
					headers: event.request.headers
				});
			} catch (error) {
				logError('login.signUp.verificationEmail', error, { userId });
				return redirect(302, '/login?checkEmail=1&emailFailed=1');
			}
			return redirect(302, '/login?checkEmail=1');
		}
		return redirect(302, '/dashboard');
	},

	signInGoogle: signInGoogleAction('Therapist')
};
