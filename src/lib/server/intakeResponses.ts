import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { intakeResponse } from '$lib/server/db/schema';
import { addClient } from '$lib/server/clients';
import { sendIntakeResponseEmail } from '$lib/server/intakeEmails';
import type { IntakeFormRow } from '$lib/server/intakeForm';
import type { ParsedIntakeAnswers } from '$lib/server/intakeQuestions';

export type IntakeResponseRow = typeof intakeResponse.$inferSelect;

function byTherapist(therapistId: string, responseId: string) {
	return and(eq(intakeResponse.id, responseId), eq(intakeResponse.therapistId, therapistId));
}

// Saves a response against the form's current questions, then emails the therapist.
export async function submitIntakeResponse(form: IntakeFormRow, parsed: ParsedIntakeAnswers): Promise<string> {
	const [row] = await db
		.insert(intakeResponse)
		.values({
			therapistId: form.therapistId,
			intakeFormId: form.id,
			questionsSnapshot: form.questions,
			answers: parsed.answers,
			email: parsed.email,
			name: parsed.name
		})
		.returning({ id: intakeResponse.id, createdAt: intakeResponse.createdAt });

	await sendIntakeResponseEmail({
		therapistId: form.therapistId,
		responseId: row.id,
		name: parsed.name,
		email: parsed.email,
		createdAt: row.createdAt
	});
	return row.id;
}

// ponytail: no pagination; add it once a therapist has hundreds of responses
export async function listIntakeResponses(therapistId: string) {
	return db
		.select({
			id: intakeResponse.id,
			name: intakeResponse.name,
			email: intakeResponse.email,
			clientId: intakeResponse.clientId,
			createdAt: intakeResponse.createdAt
		})
		.from(intakeResponse)
		.where(eq(intakeResponse.therapistId, therapistId))
		.orderBy(desc(intakeResponse.createdAt));
}

export async function getIntakeResponse(therapistId: string, responseId: string): Promise<IntakeResponseRow | null> {
	const [row] = await db.select().from(intakeResponse).where(byTherapist(therapistId, responseId));
	return row ?? null;
}

export async function deleteIntakeResponse(therapistId: string, responseId: string): Promise<void> {
	await db.delete(intakeResponse).where(byTherapist(therapistId, responseId));
}

// The newest response imported as this client, for the link back from the client page.
export async function getIntakeResponseIdForClient(therapistId: string, clientId: string): Promise<string | null> {
	const [row] = await db
		.select({ id: intakeResponse.id })
		.from(intakeResponse)
		.where(and(eq(intakeResponse.therapistId, therapistId), eq(intakeResponse.clientId, clientId)))
		.orderBy(desc(intakeResponse.createdAt))
		.limit(1);
	return row?.id ?? null;
}

// No name question on the form: use the part of the email before the @
function nameForImport(response: IntakeResponseRow, email: string): string {
	if (response.name) {
		return response.name;
	}
	return email.split('@')[0];
}

export type ImportResult =
	| { clientId: string; inviteUrl: string | null; emailSent: boolean }
	| { error: 'not_found' | 'no_email' | 'duplicate' | 'self' | 'limit_reached' };

// Goes through addClient, so the plan cap, duplicate-email and self-invite checks all apply
// and the normal invite email goes out. A response that already has a client is left alone —
// no second client, no second invite.
export async function importIntakeResponse(
	therapistId: string,
	responseId: string,
	origin: string
): Promise<ImportResult> {
	const response = await getIntakeResponse(therapistId, responseId);
	if (!response) {
		return { error: 'not_found' };
	}
	if (response.clientId) {
		return { clientId: response.clientId, inviteUrl: null, emailSent: true };
	}
	if (!response.email) {
		return { error: 'no_email' };
	}

	// A double-click lands both imports here; the second addClient sees the first's client
	// and returns 'duplicate', so only one client and one invite are ever made.
	const result = await addClient(
		therapistId,
		{ name: nameForImport(response, response.email), email: response.email, customFields: {}, rate: null },
		origin
	);
	// addClient's return union is normalised (every key optional), so narrow on client itself
	if (result.error !== undefined || result.client === undefined || result.inviteUrl === undefined) {
		return { error: result.error ?? 'not_found' };
	}

	await db
		.update(intakeResponse)
		.set({ clientId: result.client.id })
		.where(and(byTherapist(therapistId, responseId), isNull(intakeResponse.clientId)));

	return { clientId: result.client.id, inviteUrl: result.inviteUrl, emailSent: result.emailSent === true };
}
