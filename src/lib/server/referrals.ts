import { and, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '$lib/server/db';
import { therapist, therapistSettings, user } from '$lib/server/db/schema';
import { formatCurrency } from '$lib/format';
import type { ReferralListPage, ReferralTherapist, SpecialtyTag } from '$lib/types/referrals';

export const REFERRALS_PER_PAGE = 9;

const TAG_COLORS: SpecialtyTag['color'][] = ['plum', 'coral', 'sage', 'citrus'];

function toSpecialtyTags(labels: string[]): SpecialtyTag[] {
	const tags: SpecialtyTag[] = [];
	for (let i = 0; i < labels.length; i++) {
		tags.push({ label: labels[i], color: TAG_COLORS[i % TAG_COLORS.length] });
	}
	return tags;
}

const FORMAT_LABELS: Record<string, string> = {
	remote: 'Remote',
	in_person: 'In-person',
	hybrid: 'Remote & in-person'
};

type ListOptions = {
	page?: number;
	q?: string;
};

export async function listReferralTherapists(
	viewerTherapistId: string,
	options: ListOptions = {}
): Promise<ReferralListPage> {
	let page = options.page ?? 1;
	if (page < 1) {
		page = 1;
	}
	const q = options.q?.trim() ?? '';

	const filters = [eq(therapistSettings.referralVisible, true), ne(therapist.id, viewerTherapistId)];
	if (q) {
		const pattern = `%${q}%`;
		filters.push(
			or(
				ilike(user.name, pattern),
				sql`EXISTS (SELECT 1 FROM unnest(${therapist.tags}) AS tag WHERE tag ILIKE ${pattern})`
			)!
		);
	}
	const where = and(...filters);

	const [{ total }] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.innerJoin(therapistSettings, eq(therapistSettings.therapistId, therapist.id))
		.where(where);

	const rows = await db
		.select({
			id: therapist.id,
			name: user.name,
			bio: therapist.bio,
			tags: therapist.tags,
			location: therapist.location,
			sessionFormat: therapist.sessionFormat,
			yearsExperience: therapist.yearsExperience,
			sessionRate: therapist.sessionRate,
			currency: therapist.currency,
			showYears: therapistSettings.referralShowYears,
			showRate: therapistSettings.referralShowRate
		})
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.innerJoin(therapistSettings, eq(therapistSettings.therapistId, therapist.id))
		.where(where)
		.orderBy(user.name)
		.limit(REFERRALS_PER_PAGE)
		.offset((page - 1) * REFERRALS_PER_PAGE);

	const therapists: ReferralTherapist[] = [];
	for (const row of rows) {
		let years: number | null = null;
		if (row.showYears && row.yearsExperience !== null) {
			years = row.yearsExperience;
		}

		let rate: string | null = null;
		if (row.showRate && row.sessionRate !== null) {
			rate = formatCurrency(row.sessionRate, row.currency);
		}

		let format: string | null = null;
		if (row.sessionFormat) {
			format = FORMAT_LABELS[row.sessionFormat] ?? null;
		}

		therapists.push({
			id: row.id,
			name: row.name,
			format,
			location: row.location,
			years,
			specialtyTags: toSpecialtyTags(row.tags),
			bio: row.bio ?? '',
			rate
		});
	}

	return { therapists, total, page, perPage: REFERRALS_PER_PAGE };
}

export type ReferralProfile = {
	name: string;
	bio: string;
	tags: string[];
	location: string | null;
	sessionFormat: 'remote' | 'in_person' | 'hybrid' | null;
	yearsExperience: number | null;
	sessionRate: number | null;
	referralVisible: boolean;
	referralShowYears: boolean;
	referralShowRate: boolean;
};

export async function getReferralProfile(therapistId: string): Promise<ReferralProfile> {
	const [row] = await db
		.select({
			name: user.name,
			bio: therapist.bio,
			tags: therapist.tags,
			location: therapist.location,
			sessionFormat: therapist.sessionFormat,
			yearsExperience: therapist.yearsExperience,
			sessionRate: therapist.sessionRate,
			referralVisible: therapistSettings.referralVisible,
			referralShowYears: therapistSettings.referralShowYears,
			referralShowRate: therapistSettings.referralShowRate
		})
		.from(therapist)
		.innerJoin(user, eq(therapist.userId, user.id))
		.leftJoin(therapistSettings, eq(therapistSettings.therapistId, therapist.id))
		.where(eq(therapist.id, therapistId));

	return {
		name: row.name,
		bio: row.bio ?? '',
		tags: row.tags,
		location: row.location,
		sessionFormat: row.sessionFormat,
		yearsExperience: row.yearsExperience,
		sessionRate: row.sessionRate,
		referralVisible: row.referralVisible ?? false,
		referralShowYears: row.referralShowYears ?? true,
		referralShowRate: row.referralShowRate ?? true
	};
}

export type ReferralProfileInput = {
	name: string;
	bio: string;
	tags: string[];
	location: string | null;
	sessionFormat: 'remote' | 'in_person' | 'hybrid' | null;
	yearsExperience: number | null;
	sessionRate: number | null;
	referralVisible: boolean;
	referralShowYears: boolean;
	referralShowRate: boolean;
};

export async function updateReferralProfile(
	therapistId: string,
	input: ReferralProfileInput,
	executor: DbOrTx = db
) {
	const [row] = await executor
		.update(therapist)
		.set({
			bio: input.bio,
			tags: input.tags,
			location: input.location,
			sessionFormat: input.sessionFormat,
			yearsExperience: input.yearsExperience,
			sessionRate: input.sessionRate
		})
		.where(eq(therapist.id, therapistId))
		.returning({ userId: therapist.userId });

	await executor.update(user).set({ name: input.name }).where(eq(user.id, row.userId));

	await executor
		.update(therapistSettings)
		.set({
			referralVisible: input.referralVisible,
			referralShowYears: input.referralShowYears,
			referralShowRate: input.referralShowRate
		})
		.where(eq(therapistSettings.therapistId, therapistId));
}