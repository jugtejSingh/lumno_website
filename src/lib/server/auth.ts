import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { sendEmail, wrapEmail } from '$lib/server/email';

const VERIFICATION_EMAIL_RESEND_INTERVAL_MS = 12 * 60 * 60 * 1000;

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	session: {
		// ponytail: signed cookie copy of the session so getSession skips the DB for 5 min.
		// A revoked session stays valid client-side for up to maxAge; shorten if that matters.
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60
		}
	},
	user: {
		additionalFields: {
			verificationEmailSentAt: { type: 'date', required: false, input: false }
		}
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true
	},
	emailVerification: {
		// clients are force-verified via linkClientToUser right after their invite
		// signup, so they never hit sendOnSignUp or the requireEmailVerification
		// gate below — only therapists do. Therapists get their first email via
		// an explicit auth.api.sendVerificationEmail call in the signup action.
		sendOnSignUp: false,
		sendOnSignIn: true,
		expiresIn: VERIFICATION_EMAIL_RESEND_INTERVAL_MS / 1000, // 12h — matches the resend throttle below
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user: authUser, url }) => {
			const [dbUser] = await db
				.select({ verificationEmailSentAt: user.verificationEmailSentAt })
				.from(user)
				.where(eq(user.id, authUser.id));

			const sentAt = dbUser?.verificationEmailSentAt;
			if (sentAt && Date.now() - sentAt.getTime() < VERIFICATION_EMAIL_RESEND_INTERVAL_MS) {
				return; // still within the resend window, skip
			}

			await sendEmail(
				authUser.email,
				'Verify your email',
				wrapEmail({
					heading: 'Verify your email',
					bodyHtml: `<p>Click the button below to verify your email address and finish setting up your Lumno account.</p>`,
					cta: { text: 'Verify email', url }
				}),
				{ text: `Verify your email address:\n${url}` }
			);
			await db.update(user).set({ verificationEmailSentAt: new Date() }).where(eq(user.id, authUser.id));
		}
	},
	socialProviders: {
		google: {
			clientId: env.CLIENT_ID,
			clientSecret: env.CLIENT_SECRET,
			// needed so we can create a Meet link on the therapist's calendar for online
			// appointments (see $lib/server/googleCalendar.ts); offline+consent gets us a
			// refresh token even for existing users who already granted the base scopes
			scope: ['https://www.googleapis.com/auth/calendar.events'],
			accessType: 'offline',
			prompt: 'consent'
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
