import type { Actions, PageServerLoad } from './$types';
import { disableIntakeLink, generateIntakeLink, getIntakeForm } from '$lib/server/intakeForm';
import { listIntakeResponses } from '$lib/server/intakeResponses';

export const load: PageServerLoad = async (event) => {
	const therapistId = event.locals.therapistId!;
	const [form, responses] = await Promise.all([getIntakeForm(therapistId), listIntakeResponses(therapistId)]);

	let shareToken: string | null = null;
	let questionCount = 0;
	if (form) {
		shareToken = form.shareToken;
		questionCount = form.questions.length;
	}
	return { shareToken, questionCount, responses };
};

export const actions: Actions = {
	generateLink: async (event) => {
		await generateIntakeLink(event.locals.therapistId!);
	},

	disableLink: async (event) => {
		await disableIntakeLink(event.locals.therapistId!);
	}
};
