import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { intakeForm } from '$lib/server/db/schema';
import type { IntakeQuestion } from '$lib/types/intake';

// ponytail: one form per therapist (intake_form.therapist_id is unique), so every function
// here is keyed by therapist. Multiple forms = key by the form's id instead.
export const DEFAULT_INTAKE_TITLE = 'Intake form';

export type IntakeFormRow = typeof intakeForm.$inferSelect;

export type IntakeFormInput = {
	title: string;
	intro: string | null;
	questions: IntakeQuestion[];
};

function thisForm(therapistId: string) {
	return eq(intakeForm.therapistId, therapistId);
}

function newShareToken(): string {
	return randomBytes(24).toString('base64url');
}

// null until the therapist first saves the form or turns the link on
export async function getIntakeForm(therapistId: string): Promise<IntakeFormRow | null> {
	const [row] = await db.select().from(intakeForm).where(thisForm(therapistId));
	return row ?? null;
}

export async function saveIntakeForm(therapistId: string, input: IntakeFormInput): Promise<void> {
	await db
		.insert(intakeForm)
		.values({ therapistId, ...input })
		.onConflictDoUpdate({
			target: intakeForm.therapistId,
			set: { title: input.title, intro: input.intro, questions: input.questions, updatedAt: new Date() }
		});
}

// Turning on and regenerating are the same operation: a fresh token replaces any old one,
// so the previous link dies immediately. Creates an empty form if there isn't one yet.
export async function generateIntakeLink(therapistId: string): Promise<string> {
	const shareToken = newShareToken();
	await db
		.insert(intakeForm)
		.values({ therapistId, title: DEFAULT_INTAKE_TITLE, shareToken })
		.onConflictDoUpdate({
			target: intakeForm.therapistId,
			set: { shareToken, updatedAt: new Date() }
		});
	return shareToken;
}

export async function disableIntakeLink(therapistId: string): Promise<void> {
	await db.update(intakeForm).set({ shareToken: null }).where(thisForm(therapistId));
}

// Public lookup. Off and unknown tokens both return null so callers can't tell them apart.
export async function findIntakeFormByToken(token: string): Promise<IntakeFormRow | null> {
	if (!token) {
		return null;
	}
	const [row] = await db.select().from(intakeForm).where(eq(intakeForm.shareToken, token));
	return row ?? null;
}
