import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { therapist } from '$lib/server/db/schema';

// Marks the first-visit welcome modal as seen so the (app) layout stops showing it.
export const POST: RequestHandler = async ({ locals }) => {
	const therapistId = locals.therapistId!;
	await db
		.update(therapist)
		.set({ welcomeSeenAt: new Date() })
		.where(eq(therapist.id, therapistId));
	return new Response(null, { status: 204 });
};
