import { deserialize } from '$app/forms';
import type { ResourceUploadTicket } from '$lib/types/resources';

// Browser side of the resource form actions (see $lib/server/resourceActions).
// Posts to ?/<action> on the current page, so it works on both /clients and /portal.

type ActionOutcome = { ok: true; data: Record<string, unknown> } | { ok: false; message: string };

export async function postResourceAction(
	action: string,
	fields: Record<string, string>
): Promise<ActionOutcome> {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		body.append(key, value);
	}

	let response: Response;
	try {
		response = await fetch(`?/${action}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
	} catch {
		return { ok: false, message: 'Network error — please try again' };
	}

	const result = deserialize(await response.text());
	if (result.type === 'success') {
		return { ok: true, data: result.data ?? {} };
	}
	if (result.type === 'failure') {
		const message = result.data?.resourceMessage;
		if (typeof message === 'string') {
			return { ok: false, message };
		}
	}
	return { ok: false, message: 'Something went wrong. Please try again.' };
}

// The browser → S3 leg. Field order matters: S3 requires `file` to come last.
export async function uploadToS3(ticket: ResourceUploadTicket, file: File): Promise<boolean> {
	const body = new FormData();
	for (const [key, value] of Object.entries(ticket.fields)) {
		body.append(key, value);
	}
	body.append('file', file);

	try {
		const response = await fetch(ticket.url, { method: 'POST', body });
		return response.ok;
	} catch {
		return false;
	}
}
