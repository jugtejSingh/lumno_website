import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { therapistFor } from '$lib/server/destination';

// A logged-out visitor who picks Basic/Pro on /pricing gets `pending_plan` set
// and is sent to login. On the next authenticated request — any route — we
// consume that cookie once and bounce them to /pricing to finish checkout.
const PENDING_PLAN_COOKIE = 'pending_plan';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const pending = cookies.get(PENDING_PLAN_COOKIE);
	if (!pending) {
		return {};
	}

	// Still mid-login — leave the cookie for when they come back authenticated.
	if (!locals.user) {
		return {};
	}

	// One-shot: consumed now regardless of whether checkout actually starts.
	cookies.delete(PENDING_PLAN_COOKIE, { path: '/' });

	// Only therapists can subscribe, and only basic/pro route through here.
	// hooks only resolves therapistId under /(app), so check directly.
	let isTherapist: boolean;
	if (locals.therapistId) {
		isTherapist = true;
	} else {
		isTherapist = (await therapistFor(locals.user.id)) !== null;
	}

	if (isTherapist && (pending === 'basic' || pending === 'pro')) {
		redirect(302, `/pricing?buy=${pending}`);
	}

	return {};
};