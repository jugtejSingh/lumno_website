import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listResources, therapistScope } from '$lib/server/resources';

// Backs the resources dialog on /clients. Fetched on open rather than in the page
// load so we only sign S3 URLs for the one client being looked at.
export const GET: RequestHandler = async ({ params, locals }) => {
	const scope = await therapistScope(locals.therapistId!, params.clientId);
	if (!scope) {
		error(404, 'Client not found');
	}
	return json({ resources: await listResources(scope) });
};
