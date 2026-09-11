import type { LayoutServerLoad } from './$types';

// Auth + therapist gate lives in hooks.server.ts (covers endpoints too), so
// locals.user / locals.therapist are guaranteed here.
export const load: LayoutServerLoad = async (event) => {
	return { user: event.locals.user!, therapist: event.locals.therapist! };
};
