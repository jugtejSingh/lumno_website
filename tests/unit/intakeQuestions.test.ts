import { describe, it, expect } from 'vitest';
import { parseIntakeAnswers, parseIntakeQuestions } from '$lib/server/intakeQuestions';
import { intakeAnswerInputName, type IntakeQuestion } from '$lib/types/intake';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

function questions(list: unknown[]) {
	return parseIntakeQuestions(JSON.stringify(list));
}

describe('parseIntakeQuestions', () => {
	it('keeps valid ids, trims text and drops blank choices', () => {
		const result = questions([
			{ id: ID_A, label: '  Pronouns ', type: 'short_text', required: true },
			{ id: ID_B, label: 'Session type', type: 'single_choice', required: false, choices: [' Online', '', 'In person'] }
		]);
		expect(result).toEqual({
			questions: [
				{ id: ID_A, label: 'Pronouns', type: 'short_text', required: true },
				{ id: ID_B, label: 'Session type', type: 'single_choice', required: false, choices: ['Online', 'In person'] }
			]
		});
	});

	it('mints a fresh id for a missing, malformed or repeated id', () => {
		const result = questions([
			{ id: ID_A, label: 'One', type: 'short_text' },
			{ id: ID_A, label: 'Two', type: 'short_text' },
			{ id: 'nope', label: 'Three', type: 'short_text' }
		]);
		if (!('questions' in result)) {
			throw new Error(result.error);
		}
		const ids = new Set<string>();
		for (const question of result.questions) {
			ids.add(question.id);
		}
		expect(ids.size).toBe(3);
		expect(result.questions[0].id).toBe(ID_A);
	});

	it('drops choices from non-choice questions', () => {
		const result = questions([{ id: ID_A, label: 'Age', type: 'number', choices: ['x', 'y'] }]);
		expect(result).toEqual({ questions: [{ id: ID_A, label: 'Age', type: 'number', required: false }] });
	});

	it('rejects bad input', () => {
		expect(parseIntakeQuestions('not json')).toHaveProperty('error');
		expect(parseIntakeQuestions('{}')).toHaveProperty('error');
		expect(questions([{ label: '', type: 'short_text' }])).toHaveProperty('error');
		expect(questions([{ label: 'x', type: 'file_upload' }])).toHaveProperty('error');
		expect(questions([{ label: 'x'.repeat(201), type: 'short_text' }])).toHaveProperty('error');
		expect(questions([{ label: 'Pick', type: 'single_choice', choices: ['only one'] }])).toHaveProperty('error');
		expect(questions([{ label: 'Pick', type: 'multiple_choice', choices: ['A', 'a'] }])).toHaveProperty('error');
		expect(
			questions([
				{ label: 'Email', type: 'email' },
				{ label: 'Other email', type: 'email' }
			])
		).toHaveProperty('error');
		expect(
			questions([
				{ label: 'Name', type: 'name' },
				{ label: 'Name again', type: 'name' }
			])
		).toHaveProperty('error');
		const tooMany: unknown[] = [];
		for (let i = 0; i < 51; i++) {
			tooMany.push({ label: `Q${i}`, type: 'short_text' });
		}
		expect(questions(tooMany)).toHaveProperty('error');
	});
});

function q(id: string, type: IntakeQuestion['type'], extra: Partial<IntakeQuestion> = {}): IntakeQuestion {
	return { id, label: id, type, required: false, ...extra };
}

function formWith(entries: [string, string][]): FormData {
	const form = new FormData();
	for (const [questionId, value] of entries) {
		form.append(intakeAnswerInputName(questionId), value);
	}
	return form;
}

describe('parseIntakeAnswers', () => {
	const all: IntakeQuestion[] = [
		q('short', 'short_text'),
		q('long', 'long_text'),
		q('one', 'single_choice', { choices: ['Online', 'In person'] }),
		q('many', 'multiple_choice', { choices: ['Anxiety', 'Grief', 'Other'] }),
		q('yn', 'yes_no'),
		q('dob', 'date'),
		q('age', 'number'),
		q('mail', 'email'),
		q('tel', 'phone'),
		q('who', 'name')
	];

	it('reads every type and pulls out email and name', () => {
		const result = parseIntakeAnswers(
			all,
			formWith([
				['short', ' they/them '],
				['long', 'Some text'],
				['one', 'Online'],
				['many', 'Anxiety'],
				['many', 'Grief'],
				['many', 'Anxiety'],
				['yn', 'no'],
				['dob', '1990-02-28'],
				['age', '34'],
				['mail', 'sam@example.com'],
				['tel', '+910000000000'],
				['who', 'Sam Guest']
			])
		);
		expect(result).toEqual({
			answers: {
				short: 'they/them',
				long: 'Some text',
				one: 'Online',
				many: ['Anxiety', 'Grief'],
				yn: false,
				dob: '1990-02-28',
				age: 34,
				mail: 'sam@example.com',
				tel: '+910000000000',
				who: 'Sam Guest'
			},
			email: 'sam@example.com',
			name: 'Sam Guest'
		});
	});

	it('leaves blank optional answers out', () => {
		expect(parseIntakeAnswers(all, formWith([]))).toEqual({ answers: {}, email: null, name: null });
	});

	it('requires required questions', () => {
		const result = parseIntakeAnswers([q('short', 'short_text', { required: true })], formWith([]));
		expect(result).toMatchObject({ questionId: 'short' });
	});

	it('rejects answers that do not fit the type', () => {
		const bad: [IntakeQuestion, string][] = [
			[q('x', 'single_choice', { choices: ['A', 'B'] }), 'C'],
			[q('x', 'multiple_choice', { choices: ['A', 'B'] }), 'C'],
			[q('x', 'yes_no'), 'maybe'],
			[q('x', 'date'), '2026-02-31'],
			[q('x', 'date'), '31/01/2026'],
			[q('x', 'number'), 'abc'],
			[q('x', 'email'), 'not-an-email'],
			[q('x', 'phone'), '12345'],
			[q('x', 'short_text'), 'a'.repeat(201)],
			[q('x', 'long_text'), 'a'.repeat(5001)]
		];
		for (const [question, value] of bad) {
			const result = parseIntakeAnswers([question], formWith([['x', value]]));
			expect(result, `${question.type}: ${value.slice(0, 20)}`).toMatchObject({ questionId: 'x' });
		}
	});
});
