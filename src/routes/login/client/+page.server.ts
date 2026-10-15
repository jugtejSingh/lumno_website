import type { Actions, PageServerLoad } from './$types';
import { loadLoginPage, signInEmailAction, signInGoogleAction } from '$lib/server/loginActions';

export const load: PageServerLoad = loadLoginPage;

// Sign-in only: client accounts are created from a practitioner's invite.
export const actions: Actions = {
	signInEmail: signInEmailAction('Client'),
	signInGoogle: signInGoogleAction('Client')
};
