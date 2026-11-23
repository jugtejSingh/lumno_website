import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { client, intakeResponse } from '$lib/server/db/schema';
import { sendEmail } from '$lib/server/email';
import {
	findIntakeFormByToken,
	generateIntakeLink,
	disableIntakeLink,
	getIntakeForm,
	saveIntakeForm
} from '$lib/server/intakeForm';
import { parseIntakeAnswers } from '$lib/server/intakeQuestions';
import { importIntakeResponse, listIntakeResponses, submitIntakeResponse } from '$lib/server/intakeResponses';
import { intakeAnswerInputName, type IntakeQuestion } from '$lib/types/intake';
import { resetDb, mkTherapist } from './helpers';

// Link lifecycle, then submit → response stored → import → client created → second import no-op.

const questions: IntakeQuestion[] = [
	{ id: '11111111-1111-4111-8111-111111111111', label: 'Your name', type: 'name', required: true },
	{ id: '22222222-2222-4222-8222-222222222222', label: 'Your email', type: 'email', required: true },
	{ id: '33333333-3333-4333-8333-333333333333', label: 'What brings you here?', type: 'long_text', required: false }
];

let therapistId: string;

beforeEach(async () => {
	await resetDb();
	vi.mocked(sendEmail).mockClear();
	therapistId = (await mkTherapist()).id;
});

async function submit(name: string, email: string) {
	const form = (await findIntakeFormByToken((await getIntakeForm(therapistId))!.shareToken!))!;
	const formData = new FormData();
	formData.set(intakeAnswerInputName(questions[0].id), name);
	formData.set(intakeAnswerInputName(questions[1].id), email);
	formData.set(intakeAnswerInputName(questions[2].id), 'Feeling anxious');
	const parsed = parseIntakeAnswers(form.questions, formData);
	if ('error' in parsed) {
		throw new Error(parsed.error);
	}
	return submitIntakeResponse(form, parsed);
}

describe('intake link', () => {
	it('regenerating kills the old token and turning off kills the current one', async () => {
		const first = await generateIntakeLink(therapistId);
		const formId = (await findIntakeFormByToken(first))?.id;
		expect(formId).toBeDefined();

		// same form row, new token
		const second = await generateIntakeLink(therapistId);
		expect(await findIntakeFormByToken(first)).toBeNull();
		expect((await findIntakeFormByToken(second))?.id).toBe(formId);

		await disableIntakeLink(therapistId);
		expect(await findIntakeFormByToken(second)).toBeNull();
	});

	it('saving keeps the link and stays one form per therapist', async () => {
		const token = await generateIntakeLink(therapistId);
		await saveIntakeForm(therapistId, { title: 'Hello', intro: null, questions });
		await saveIntakeForm(therapistId, { title: 'Hello again', intro: 'Hi', questions });
		const form = await getIntakeForm(therapistId);
		expect(form).toMatchObject({ title: 'Hello again', intro: 'Hi', shareToken: token });
	});
});

describe('intake responses', () => {
	beforeEach(async () => {
		await generateIntakeLink(therapistId);
		await saveIntakeForm(therapistId, { title: 'Intake', intro: null, questions });
	});

	it('stores a response with a question snapshot and emails the therapist', async () => {
		const responseId = await submit('Sam Guest', 'sam@example.com');

		const formId = (await getIntakeForm(therapistId))!.id;
		const [row] = await db.select().from(intakeResponse).where(eq(intakeResponse.id, responseId));
		expect(row).toMatchObject({ therapistId, intakeFormId: formId, name: 'Sam Guest', email: 'sam@example.com' });
		expect(row.questionsSnapshot).toEqual(questions);

		// editing the form later leaves the snapshot alone
		await saveIntakeForm(therapistId, { title: 'Intake', intro: null, questions: [questions[1]] });
		const [after] = await db.select().from(intakeResponse).where(eq(intakeResponse.id, responseId));
		expect(after.questionsSnapshot).toEqual(questions);

		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(vi.mocked(sendEmail).mock.calls[0][1]).toBe('New intake response from Sam Guest');
		expect(await listIntakeResponses(therapistId)).toHaveLength(1);
	});

	it('a new link keeps earlier responses on the same form', async () => {
		const before = await submit('Sam Guest', 'sam@example.com');
		await generateIntakeLink(therapistId);
		const after = await submit('Alex Guest', 'alex@example.com');

		const formId = (await getIntakeForm(therapistId))!.id;
		const rows = await db.select().from(intakeResponse).where(eq(intakeResponse.intakeFormId, formId));
		const ids: string[] = [];
		for (const row of rows) {
			ids.push(row.id);
		}
		expect(ids.sort()).toEqual([before, after].sort());
		expect(await listIntakeResponses(therapistId)).toHaveLength(2);
	});

	it('imports once: a second import creates no second client and sends no second invite', async () => {
		const responseId = await submit('Sam Guest', 'sam@example.com');
		vi.mocked(sendEmail).mockClear();

		const first = await importIntakeResponse(therapistId, responseId, 'http://localhost');
		if ('error' in first) {
			throw new Error(first.error);
		}
		const clients = await db.select().from(client).where(eq(client.therapistId, therapistId));
		expect(clients).toHaveLength(1);
		expect(clients[0]).toMatchObject({ name: 'Sam Guest', email: 'sam@example.com' });
		expect(sendEmail).toHaveBeenCalledTimes(1);

		const second = await importIntakeResponse(therapistId, responseId, 'http://localhost');
		expect(second).toMatchObject({ clientId: first.clientId });
		expect(await db.select().from(client).where(eq(client.therapistId, therapistId))).toHaveLength(1);
		expect(sendEmail).toHaveBeenCalledTimes(1);
	});

	it("can't import another therapist's response", async () => {
		const responseId = await submit('Sam Guest', 'sam@example.com');
		const other = await mkTherapist();
		expect(await importIntakeResponse(other.id, responseId, 'http://localhost')).toEqual({ error: 'not_found' });
	});
});
