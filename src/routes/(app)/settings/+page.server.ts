import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getOrCreateSubscription } from '$lib/server/billing';
import { getReferralProfile, updateReferralProfile } from '$lib/server/referrals';

const FORMATS = ['remote', 'in_person', 'hybrid'] as const;

export const load: PageServerLoad = async ({ locals }) => {
	const [profile, subscription] = await Promise.all([
		getReferralProfile(locals.therapistId!),
		// Raw plan/status, not getEffectivePlan — a past_due row intentionally keeps
		// its plan number so the card can show "Pro — payment failed" instead of
		// silently reading as Free. See the webhook handler's plan-retention comment.
		getOrCreateSubscription(locals.therapistId!)
	]);

	const billing = {
		plan: subscription.plan,
		status: subscription.status,
		cancelScheduled: subscription.cancelScheduled
	};

	return { profile, billing };
};

function parseIntOrNull(value: string): number | null {
	if (!value.trim()) {
		return null;
	}
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 0) {
		return null;
	}
	return n;
}

export const actions: Actions = {
	saveReferralProfile: async ({ request, locals }) => {
		const form = await request.formData();

		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) {
			return fail(400, { message: 'Name is required' });
		}

		const formatRaw = form.get('sessionFormat')?.toString() ?? '';
		let sessionFormat: (typeof FORMATS)[number] | null = null;
		if ((FORMATS as readonly string[]).includes(formatRaw)) {
			sessionFormat = formatRaw as (typeof FORMATS)[number];
		}

		const tags = form
			.get('tags')
			?.toString()
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean) ?? [];

		await updateReferralProfile(locals.therapistId!, {
			name,
			bio: form.get('bio')?.toString().trim() ?? '',
			tags,
			location: form.get('location')?.toString().trim() || null,
			sessionFormat,
			yearsExperience: parseIntOrNull(form.get('yearsExperience')?.toString() ?? ''),
			sessionRate: parseIntOrNull(form.get('sessionRate')?.toString() ?? ''),
			referralVisible: form.get('referralVisible') === 'on',
			referralShowYears: form.get('referralShowYears') === 'on',
			referralShowRate: form.get('referralShowRate') === 'on'
		});

		return { saved: true };
	}
};