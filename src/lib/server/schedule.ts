import { listDesignedDaysForMonth } from '$lib/server/availabilitySlots';

export type DayKind = 'online' | 'in_person' | 'hybrid' | 'off';

/**
 * Effective kind of each day of the month, derived from its designed slots:
 * no slots = 'off', all slots share one modality = that modality, mixed = 'hybrid'.
 */
export async function listDayKindsForMonth(therapistId: string, year: number, month: number) {
	const designByDay = await listDesignedDaysForMonth(therapistId, year, month);

	const dayKinds: Record<number, DayKind> = {};
	for (const [dayText, design] of Object.entries(designByDay)) {
		let kind: DayKind = 'off';
		for (const slot of design.slots) {
			if (kind === 'off') {
				kind = slot.modality;
			} else if (kind !== slot.modality) {
				kind = 'hybrid';
			}
		}
		dayKinds[Number(dayText)] = kind;
	}
	return dayKinds;
}
