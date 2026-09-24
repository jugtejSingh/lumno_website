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

	// Layout data is serialized to the client's browser. Allow-list only what the client
	// owns or the portal needs to route — never select() the whole row, which would ship
	// the therapist's private notes (customFields), tags, rate, invite/billing state, etc.
	// A new client column stays out of the portal until it's added here on purpose.
	const [clientRow, clients] = await Promise.all([
		db
			.select({
				id: client.id,
				therapistId: client.therapistId,
				name: client.name,
				phone: client.phone,
				dateOfBirth: client.dateOfBirth,
				gender: client.gender,
				city: client.city,
				state: client.state,
				country: client.country,
				timezone: client.timezone
			})
			.from(client)
			.where(eq(client.id, event.locals.clientId))
			.then(([row]) => row),
		listClientsForUser(event.locals.user.id)
	]);

	// switcher only makes sense to show when there's more than one to switch between
	return { user: event.locals.user, client: clientRow, clients: clients.length > 1 ? clients : [] };
};