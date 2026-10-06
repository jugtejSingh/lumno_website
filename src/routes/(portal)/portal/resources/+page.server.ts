import type { Actions, PageServerLoad } from './$types';
import { resourceActions } from '$lib/server/resourceActions';
import { clientScope, listResources } from '$lib/server/resources';
import type { ResourceRow } from '$lib/types/resources';

export const load: PageServerLoad = async (event) => {
	const { client } = await event.parent();

	let resources: ResourceRow[] = [];
	const resourceScope = await clientScope(client.id);
	if (resourceScope) {
		resources = await listResources(resourceScope);
	}

	return { resources };
};

export const actions: Actions = {
	// scope comes from the session's active client, never from the posted form
	...resourceActions(async (event) => {
		if (!event.locals.clientId) {
			return null;
		}
		return clientScope(event.locals.clientId);
	})
};
