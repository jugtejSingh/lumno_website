import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { therapist, client } from '$lib/server/db/schema';

export async function therapistFor(userId: string) {
	const [therapistRow] = await db.select().from(therapist).where(eq(therapist.userId, userId));
	return therapistRow ?? null;
}

export async function clientFor(userId: string) {
	const [clientRow] = await db.select().from(client).where(eq(client.userId, userId));
	return clientRow ?? null;
}

export async function destinationFor(userId: string): Promise<'/dashboard' | '/portal' | null> {
	if (await therapistFor(userId)) return '/dashboard';
	if (await clientFor(userId)) return '/portal';
	return null;
}

// Login is role-scoped: picking "Therapist" or "Client" on the login form must land
// on that specific row, not whichever one destinationFor would prioritize.
export async function destinationForRole(
	userId: string,
	role: 'Therapist' | 'Client'
): Promise<'/dashboard' | '/portal' | null> {
	if (role === 'Therapist') {
		return (await therapistFor(userId)) ? '/dashboard' : null;
	}
	return (await clientFor(userId)) ? '/portal' : null;
}