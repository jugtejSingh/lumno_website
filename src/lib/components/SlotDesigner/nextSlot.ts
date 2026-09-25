import type { DesignedSlot } from '$lib/types/slots';

// "HH:MM" + minutes, clamped to 23:59 so a new slot never spills into tomorrow
function addMinutes(time: string, minutes: number): string {
	const [hour, minute] = time.split(':').map(Number);
	const total = Math.min(hour * 60 + minute + minutes, 23 * 60 + 59);
	const nextHour = String(Math.floor(total / 60)).padStart(2, '0');
	const nextMinute = String(total % 60).padStart(2, '0');
	return `${nextHour}:${nextMinute}`;
}

/** A new slot starts where the latest one ends, an hour long, same type. */
export function nextSlot(slots: DesignedSlot[]): DesignedSlot {
	let startTime = '09:00';
	let modality: DesignedSlot['modality'] = 'online';
	for (const slot of slots) {
		if (slot.endTime > startTime) {
			startTime = slot.endTime;
			modality = slot.modality;
		}
	}
	return { startTime, endTime: addMinutes(startTime, 60), modality };
}
