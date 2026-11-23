import { eq } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { therapist, user } from '$lib/server/db/schema';
import { findIntakeFormByToken } from '$lib/server/intakeForm';
import { parseIntakeAnswers } from '$lib/server/intakeQuestions';
import { submitIntakeResponse } from '$lib/server/intakeResponses';
import { intakeSubmitRatelimit } from '$lib/server/rateLimit';

// same switch as hooks.server.ts: Playwright's dev server only
const skipRateLimitForE2E = dev && env.E2E === '1';

export const load: PageServerLoad = async ({ params }) => {
	const form = await findIntakeFormByToken(params.token);
	if (!form) {
		// off and unknown look identical on purpose
		error(404, 'Page not found');
	}

	const [therapistRow] = await db
		.select({ name: user.name })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.where(eq(therapist.id, form.therapistId));

	return {
		therapistName: therapistRow?.name ?? 'your practitioner',
		title: form.title,
		intro: form.intro,
		questions: form.questions
	};
};

export const actions: Actions = {
	submit: async ({ params, request, getClientAddress }) => {
		const form = await findIntakeFormByToken(params.token);
		if (!form) {
			return fail(404, { message: 'This form is no longer accepting responses' });
		}

		if (!skipRateLimitForE2E) {
			const { success } = await intakeSubmitRatelimit.limit(getClientAddress());
			if (!success) {
				return fail(429, { message: 'Too many submissions from your connection. Please try again later.' });
			}
		}

		const formData = await request.formData();
		const parsed = parseIntakeAnswers(form.questions, formData);
		if ('error' in parsed) {
			return fail(400, { message: parsed.error, questionId: parsed.questionId });
		}

		await submitIntakeResponse(form, parsed);
		return { submitted: true };
	}
};
