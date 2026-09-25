import { deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';

// The weekly dialog saves each change on its own (docs/weekly slots.md §7): every row, the
// day settings and the reserve picker post one calendar action, then the page data reloads.

export type Booking = { created: number; blocked: number; failed: number };

export type SlotActionResult = { ok: true; booking?: Booking } | { ok: false; message: string };

export async function postSlotAction(
	action: string,
	fields: Record<string, string | string[]>
): Promise<SlotActionResult> {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				body.append(name, item);
			}
		} else {
			body.set(name, value);
		}
	}

	let result;
	try {
		const response = await fetch(`?/${action}`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body
		});
		result = deserialize(await response.text());
	} catch {
		return { ok: false, message: 'Could not save — check your connection and try again' };
	}

	if (result.type === 'success') {
		await invalidateAll();
		const booking = result.data?.booking as Booking | undefined;
		return { ok: true, booking };
	}
	if (result.type === 'failure' && typeof result.data?.message === 'string') {
		return { ok: false, message: result.data.message };
	}
	return { ok: false, message: 'Could not save — reload and try again' };
}

// e.g. "Booked 2 sessions · 1 week blocked by an existing session"
export function bookingSummary(booking: Booking): string {
	const parts: string[] = [];
	if (booking.created === 1) {
		parts.push('Booked 1 session');
	} else {
		parts.push(`Booked ${booking.created} sessions`);
	}
	if (booking.blocked === 1) {
		parts.push('1 week blocked by an existing session');
	} else if (booking.blocked > 1) {
		parts.push(`${booking.blocked} weeks blocked by existing sessions`);
	}
	if (booking.failed > 0) {
		parts.push(`${booking.failed} couldn’t be booked`);
	}
	return parts.join(' · ');
}
