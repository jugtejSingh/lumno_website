// Shared by the builder, the public form and the server validators (intakeQuestions.ts).

export const INTAKE_QUESTION_TYPES = [
	'short_text',
	'long_text',
	'single_choice',
	'multiple_choice',
	'yes_no',
	'date',
	'number',
	'email',
	'phone',
	'name'
] as const;

export type IntakeQuestionType = (typeof INTAKE_QUESTION_TYPES)[number];

export const INTAKE_QUESTION_TYPE_LABELS: Record<IntakeQuestionType, string> = {
	short_text: 'Short answer',
	long_text: 'Long answer',
	single_choice: 'Pick one',
	multiple_choice: 'Pick any',
	yes_no: 'Yes / No',
	date: 'Date',
	number: 'Number',
	email: 'Email',
	phone: 'Phone',
	name: 'Name'
};

export type IntakeQuestion = {
	// stable, minted by the builder when the question is added
	id: string;
	label: string;
	description?: string;
	type: IntakeQuestionType;
	required: boolean;
	// only for single_choice / multiple_choice, and required there
	choices?: string[];
};

export type IntakeAnswer = string | string[] | boolean | number;

// question id -> answer; unanswered optional questions are left out
export type IntakeAnswers = Record<string, IntakeAnswer>;

export const MAX_INTAKE_QUESTIONS = 50;
export const MAX_INTAKE_CHOICES = 20;
export const MAX_INTAKE_LABEL_LENGTH = 200;
export const MAX_INTAKE_DESCRIPTION_LENGTH = 500;
export const MAX_INTAKE_TITLE_LENGTH = 200;
export const MAX_INTAKE_INTRO_LENGTH = 2000;
export const MAX_INTAKE_SHORT_ANSWER_LENGTH = 200;
export const MAX_INTAKE_LONG_ANSWER_LENGTH = 5000;

export function isChoiceType(type: IntakeQuestionType): boolean {
	return type === 'single_choice' || type === 'multiple_choice';
}

// Form input name for one question's answer on the public form.
export function intakeAnswerInputName(questionId: string): string {
	return `q:${questionId}`;
}
