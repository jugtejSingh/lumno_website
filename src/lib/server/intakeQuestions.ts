import { randomUUID } from 'node:crypto';
import { isValidEmail } from '$lib/isValidEmail';
import { parsePhone } from '$lib/phone';
import {
	INTAKE_QUESTION_TYPES,
	MAX_INTAKE_CHOICES,
	MAX_INTAKE_DESCRIPTION_LENGTH,
	MAX_INTAKE_LABEL_LENGTH,
	MAX_INTAKE_LONG_ANSWER_LENGTH,
	MAX_INTAKE_QUESTIONS,
	MAX_INTAKE_SHORT_ANSWER_LENGTH,
	intakeAnswerInputName,
	isChoiceType,
	type IntakeAnswer,
	type IntakeAnswers,
	type IntakeQuestion,
	type IntakeQuestionType
} from '$lib/types/intake';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EMAIL_LENGTH = 200;
const MAX_NAME_LENGTH = 100;
const MAX_NUMBER_INPUT_LENGTH = 30;

function isQuestionType(value: unknown): value is IntakeQuestionType {
	return typeof value === 'string' && (INTAKE_QUESTION_TYPES as readonly string[]).includes(value);
}

function asTrimmedString(value: unknown): string {
	if (typeof value !== 'string') {
		return '';
	}
	return value.trim();
}

// The builder posts its questions as one JSON string. Anything can arrive here, so every
// field is checked and rebuilt rather than trusted. Ids follow the parseClientFieldHeadings
// rule: the builder mints a UUID per question, and anything not UUID-shaped (or repeated)
// gets a fresh one.
export function parseIntakeQuestions(raw: string): { questions: IntakeQuestion[] } | { error: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { error: 'The questions could not be read — refresh and try again' };
	}
	if (!Array.isArray(parsed)) {
		return { error: 'The questions could not be read — refresh and try again' };
	}
	if (parsed.length > MAX_INTAKE_QUESTIONS) {
		return { error: `A form can have at most ${MAX_INTAKE_QUESTIONS} questions` };
	}

	const questions: IntakeQuestion[] = [];
	const seenIds = new Set<string>();
	let emailCount = 0;
	let nameCount = 0;

	for (let i = 0; i < parsed.length; i++) {
		const item = parsed[i] as Record<string, unknown> | null;
		const position = i + 1;
		if (!item || typeof item !== 'object') {
			return { error: `Question ${position} could not be read` };
		}

		const label = asTrimmedString(item.label);
		if (!label) {
			return { error: `Question ${position} needs some question text` };
		}
		if (label.length > MAX_INTAKE_LABEL_LENGTH) {
			return { error: `Question ${position} must be ${MAX_INTAKE_LABEL_LENGTH} characters or fewer` };
		}

		const description = asTrimmedString(item.description);
		if (description.length > MAX_INTAKE_DESCRIPTION_LENGTH) {
			return {
				error: `The helper text on question ${position} must be ${MAX_INTAKE_DESCRIPTION_LENGTH} characters or fewer`
			};
		}

		if (!isQuestionType(item.type)) {
			return { error: `Question ${position} has an unknown answer type` };
		}
		const type = item.type;

		if (type === 'email') {
			emailCount = emailCount + 1;
			if (emailCount > 1) {
				return { error: 'A form can only have one email question' };
			}
		}
		if (type === 'name') {
			nameCount = nameCount + 1;
			if (nameCount > 1) {
				return { error: 'A form can only have one name question' };
			}
		}

		let id = asTrimmedString(item.id).toLowerCase();
		if (!UUID_RE.test(id) || seenIds.has(id)) {
			id = randomUUID();
		}
		seenIds.add(id);

		const question: IntakeQuestion = { id, label, type, required: item.required === true };
		if (description) {
			question.description = description;
		}

		if (isChoiceType(type)) {
			const choicesResult = parseChoices(item.choices, position);
			if ('error' in choicesResult) {
				return choicesResult;
			}
			question.choices = choicesResult.choices;
		}

		questions.push(question);
	}

	return { questions };
}

function parseChoices(raw: unknown, position: number): { choices: string[] } | { error: string } {
	const choices: string[] = [];
	const seen = new Set<string>();
	if (Array.isArray(raw)) {
		for (const entry of raw) {
			const choice = asTrimmedString(entry);
			if (!choice) {
				continue;
			}
			if (choice.length > MAX_INTAKE_LABEL_LENGTH) {
				return {
					error: `Choices on question ${position} must be ${MAX_INTAKE_LABEL_LENGTH} characters or fewer`
				};
			}
			const key = choice.toLowerCase();
			if (seen.has(key)) {
				return { error: `The choice "${choice}" is listed twice on question ${position}` };
			}
			seen.add(key);
			choices.push(choice);
		}
	}
	if (choices.length < 2) {
		return { error: `Question ${position} needs at least two choices` };
	}
	if (choices.length > MAX_INTAKE_CHOICES) {
		return { error: `Question ${position} can have at most ${MAX_INTAKE_CHOICES} choices` };
	}
	return { choices };
}

export type ParsedIntakeAnswers = {
	answers: IntakeAnswers;
	email: string | null;
	name: string | null;
};

export type IntakeAnswerError = { error: string; questionId: string };

// Reads one answer per question from the public form. Required questions must be answered;
// unanswered optional ones are left out of `answers`.
export function parseIntakeAnswers(
	questions: IntakeQuestion[],
	form: FormData
): ParsedIntakeAnswers | IntakeAnswerError {
	const answers: IntakeAnswers = {};
	let email: string | null = null;
	let name: string | null = null;

	for (const question of questions) {
		const result = parseOneAnswer(question, form);
		if ('error' in result) {
			return { error: result.error, questionId: question.id };
		}
		if (result.answer === null) {
			if (question.required) {
				return { error: `Please answer "${question.label}"`, questionId: question.id };
			}
			continue;
		}
		answers[question.id] = result.answer;
		if (question.type === 'email') {
			email = result.answer as string;
		}
		if (question.type === 'name') {
			name = result.answer as string;
		}
	}

	return { answers, email, name };
}

// answer: null means "left blank"
function parseOneAnswer(question: IntakeQuestion, form: FormData): { answer: IntakeAnswer | null } | { error: string } {
	const inputName = intakeAnswerInputName(question.id);

	if (question.type === 'multiple_choice') {
		const allowed = question.choices ?? [];
		const picked: string[] = [];
		for (const entry of form.getAll(inputName)) {
			const value = entry.toString();
			if (!allowed.includes(value)) {
				return { error: `Pick from the choices given for "${question.label}"` };
			}
			if (!picked.includes(value)) {
				picked.push(value);
			}
		}
		if (picked.length === 0) {
			return { answer: null };
		}
		return { answer: picked };
	}

	const value = (form.get(inputName)?.toString() ?? '').trim();
	if (!value) {
		return { answer: null };
	}

	if (question.type === 'short_text') {
		if (value.length > MAX_INTAKE_SHORT_ANSWER_LENGTH) {
			return { error: `Keep "${question.label}" under ${MAX_INTAKE_SHORT_ANSWER_LENGTH} characters` };
		}
		return { answer: value };
	}
	if (question.type === 'long_text') {
		if (value.length > MAX_INTAKE_LONG_ANSWER_LENGTH) {
			return { error: `Keep "${question.label}" under ${MAX_INTAKE_LONG_ANSWER_LENGTH} characters` };
		}
		return { answer: value };
	}
	if (question.type === 'single_choice') {
		const allowed = question.choices ?? [];
		if (!allowed.includes(value)) {
			return { error: `Pick one of the choices given for "${question.label}"` };
		}
		return { answer: value };
	}
	if (question.type === 'yes_no') {
		if (value === 'yes') {
			return { answer: true };
		}
		if (value === 'no') {
			return { answer: false };
		}
		return { error: `Answer yes or no to "${question.label}"` };
	}
	if (question.type === 'date') {
		if (!isRealDate(value)) {
			return { error: `Enter a valid date for "${question.label}"` };
		}
		return { answer: value };
	}
	if (question.type === 'number') {
		const number = Number(value);
		if (value.length > MAX_NUMBER_INPUT_LENGTH || !Number.isFinite(number)) {
			return { error: `Enter a number for "${question.label}"` };
		}
		return { answer: number };
	}
	if (question.type === 'email') {
		if (value.length > MAX_EMAIL_LENGTH || !isValidEmail(value)) {
			return { error: 'Enter a valid email address' };
		}
		return { answer: value };
	}
	if (question.type === 'phone') {
		const parsed = parsePhone(value);
		if ('error' in parsed) {
			return { error: parsed.error };
		}
		return { answer: parsed.phone ?? value };
	}
	// name
	if (value.length > MAX_NAME_LENGTH) {
		return { error: `Keep your name under ${MAX_NAME_LENGTH} characters` };
	}
	return { answer: value };
}

// YYYY-MM-DD that names a real calendar day (rejects 2026-02-31)
function isRealDate(value: string): boolean {
	if (!DATE_RE.test(value)) {
		return false;
	}
	const date = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) {
		return false;
	}
	return date.toISOString().slice(0, 10) === value;
}
