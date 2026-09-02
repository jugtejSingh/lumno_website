import type { PageServerLoad } from './$types';
import type { ReferralTherapist, SpecialtyTag } from '$lib/types/referrals';

const COLORS: SpecialtyTag['color'][] = ['plum', 'coral', 'sage', 'citrus'];

function tags(specialties: string[]): SpecialtyTag[] {
	return specialties.map((label, i) => ({ label, color: COLORS[i % COLORS.length] }));
}

export const load: PageServerLoad = async () => {
	const therapists: ReferralTherapist[] = [
		{
			id: 1,
			name: 'Dana Reyes',
			format: 'Remote',
			years: 6,
			specialtyTags: tags(['Anxiety', 'CBT']),
			bio: 'Works with adults managing anxiety and life transitions using CBT and mindfulness-based approaches.',
			rate: '$150'
		},
		{
			id: 2,
			name: 'Alicia Ferreira',
			format: 'In-person · Austin',
			years: 9,
			specialtyTags: tags(['Couples', 'EFT']),
			bio: 'Specializes in couples therapy and emotionally focused work for relationship repair.',
			rate: '$180'
		},
		{
			id: 3,
			name: 'Marcus Webb',
			format: 'Remote',
			years: 4,
			specialtyTags: tags(['Trauma', 'EMDR']),
			bio: 'Trauma-informed care using EMDR for clients processing past experiences.',
			rate: '$160'
		},
		{
			id: 4,
			name: 'Yuki Tanaka',
			format: 'In-person · Seattle',
			years: 12,
			specialtyTags: tags(['Grief', 'Family']),
			bio: 'Grief counseling and family systems work, often supporting multi-generational households.',
			rate: '$170'
		},
		{
			id: 5,
			name: 'Tom Bellweather',
			format: 'In-person · Chicago',
			years: 15,
			specialtyTags: tags(['Addiction', 'CBT']),
			bio: 'Two decades supporting recovery from substance use with a structured, CBT-based approach.',
			rate: '$190'
		},
		{
			id: 6,
			name: 'Nadia Kessler',
			format: 'Remote',
			years: 7,
			specialtyTags: tags(['LGBTQ+', 'Anxiety']),
			bio: 'Affirming care for LGBTQ+ clients navigating anxiety, identity, and coming-out processes.',
			rate: '$155'
		}
	];

	return { therapists };
};
