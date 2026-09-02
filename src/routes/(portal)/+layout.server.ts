import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { client } from '$lib/server/db/schema';
import { listClientsForUser } from '$lib/server/clients';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	if (!event.locals.clientId) {
		return redirect(302, '/dashboard');
	}

	const [clientRow, clients] = await Promise.all([
		db.select().from(client).where(eq(client.id, event.locals.clientId)).then(([row]) => row),
		listClientsForUser(event.locals.user.id)
	]);

	// switcher only makes sense to show when there's more than one to switch between
	return { user: event.locals.user, client: clientRow, clients: clients.length > 1 ? clients : [] };
};