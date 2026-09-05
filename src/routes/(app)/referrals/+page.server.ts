import type { PageServerLoad } from './$types';
import { listReferralTherapists } from '$lib/server/referrals';

export const load: PageServerLoad = async ({ locals, url }) => {
	const pageParam = Number(url.searchParams.get('page'));
	let page = Number.isFinite(pageParam) ? Math.trunc(pageParam) : 1;
	if (page < 1) {
		page = 1;
	}
	const q = url.searchParams.get('q') ?? '';

	const result = await listReferralTherapists(locals.therapistId!, { page, q });
	return { ...result, q };
};