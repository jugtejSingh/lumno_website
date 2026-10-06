import type { PageServerLoad } from './$types';
import { listSharedNotesForClient } from '$lib/server/notes';

const PAGE_SIZE = 5;

export const load: PageServerLoad = async (event) => {
	const { client } = await event.parent();

	const page = Math.max(1, Number(event.url.searchParams.get('page')) || 1);
	const sharedNotes = await listSharedNotesForClient(client.id, page, PAGE_SIZE);

	const notes = sharedNotes.rows.map((n) => ({
		date: n.createdAt.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}),
		text: n.body // markdown source, rendered client-side
	}));

	return {
		sharedNotes: notes,
		page,
		totalPages: Math.max(1, Math.ceil(sharedNotes.total / PAGE_SIZE))
	};
};
