import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	DEFAULT_INTAKE_TITLE,
	getIntakeForm,
	saveIntakeForm
} from '$lib/server/intakeForm';
import { parseIntakeQuestions } from '$lib/server/intakeQuestions';
import { MAX_INTAKE_INTRO_LENGTH, MAX_INTAKE_TITLE_LENGTH } from '$lib/types/intake';

export const load: PageServerLoad = async (event) => {
	const form = await getIntakeForm(event.locals.therapistId!);
	if (!form) {
		return { title: DEFAULT_INTAKE_TITLE, intro: '', questions: [], shareToken: null };
	}
	return {
		title: form.title,
		intro: form.intro ?? '',
		questions: form.questions,
		shareToken: form.shareToken
	};
};

export const actions: Actions = {
	save: async (event) => {
		const formData = await event.request.formData();
		const title = formData.get('title')?.toString().trim() ?? '';
		const intro = formData.get('intro')?.toString().trim() ?? '';

		if (!title) {
			return fail(400, { message: 'Give your form a title' });
		}
		if (title.length > MAX_INTAKE_TITLE_LENGTH) {
			return fail(400, { message: `Keep the title under ${MAX_INTAKE_TITLE_LENGTH} characters` });
		}
		if (intro.length > MAX_INTAKE_INTRO_LENGTH) {
			return fail(400, { message: `Keep the introduction under ${MAX_INTAKE_INTRO_LENGTH} characters` });
		}

		const parsed = parseIntakeQuestions(formData.get('questions')?.toString() ?? '');
		if ('error' in parsed) {
			return fail(400, { message: parsed.error });
		}

		let introValue: string | null = null;
		if (intro) {
			introValue = intro;
		}
		await saveIntakeForm(event.locals.therapistId!, { title, intro: introValue, questions: parsed.questions });
		return { saved: true };
	}
};
