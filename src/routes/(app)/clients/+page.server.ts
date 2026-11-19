import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addClient, deleteClient, listClients, resendInvite } from '$lib/server/clients';
import { getClientFieldHeadings, mergeClientFieldValues } from '$lib/server/clientFields';
import { usageLimit } from '$lib/server/billing';
import { bulkAddClients, extractBulkClients, getBulkImportAllowance } from '$lib/server/bulkClients';
import { BULK_MAX_ROWS, parseRate, type BulkRow } from '$lib/bulkClientRows';

const addErrorMessages = {
	duplicate: 'You already have a client with that email',
	self: "You can't add yourself as a client",
	limit_reached: "You've reached your plan's client limit — upgrade to add more",
	// only bulk add (allowInactive) returns this; listed so the map covers every error
	inactive_limit_reached: "You've reached your plan's client limit — upgrade to add more"
} as const;

const resendErrorMessages = {
	not_found: 'Client not found',
	no_email: 'This client has no email on file',
	already_joined: 'This client already has portal access'
} as const;

export const load: PageServerLoad = async (event) => {
	const { therapist } = await event.parent();
	const [clients, fieldHeadings, clientLimit, bulkImports] = await Promise.all([
		listClients(therapist.id),
		getClientFieldHeadings(therapist.id),
		usageLimit(therapist.id, 'clients'),
		getBulkImportAllowance(therapist.id)
	]);
	// Infinity doesn't survive serialisation to the page — null means "no cap"
	let activeClientLimit: number | null = null;
	if (clientLimit !== null && Number.isFinite(clientLimit)) {
		activeClientLimit = clientLimit;
	}
	return { clients, fieldHeadings, activeClientLimit, bulkImports };
};

// The bulkAdd form posts the reviewed rows as JSON. Anything that isn't a list of
// {name, email} strings is dropped here; bulkAddClients re-validates the rest.
function parseBulkRows(raw: string): BulkRow[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) {
		return null;
	}
	const rows: BulkRow[] = [];
	for (const entry of parsed) {
		if (!entry || typeof entry !== 'object') {
			continue;
		}
		const candidate = entry as { name?: unknown; email?: unknown; rate?: unknown };
		if (typeof candidate.name !== 'string' || typeof candidate.email !== 'string') {
			continue;
		}
		// the dialog always sends a whole number; anything else (tampered or blank) saves as 0
		let rate = parseRate(candidate.rate);
		if (rate === null) {
			rate = 0;
		}
		rows.push({ name: candidate.name, email: candidate.email, rate });
	}
	return rows;
}

export const actions: Actions = {
	add: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const email = formData.get('email')?.toString().trim() ?? '';
		const rateRaw = formData.get('rate')?.toString().trim() || '';

		const fieldErrors: Record<string, string> = {};
		if (!name.includes(' ')) {
			fieldErrors.name = 'Please enter their first and last name.';
		}
		if (!email) {
			fieldErrors.email = 'Email is required to invite the client';
		}
		if (Object.keys(fieldErrors).length > 0) {
			return fail(400, { fieldErrors });
		}

		const headings = await getClientFieldHeadings(therapistId);
		const result = await addClient(
			therapistId,
			{
				name,
				email,
				rate: rateRaw ? Number(rateRaw) : null,
				customFields: mergeClientFieldValues({}, headings, formData)
			},
			event.url.origin
		);

		if ('error' in result && result.error !== undefined) {
			if (result.error === 'duplicate' || result.error === 'self') {
				return fail(400, { fieldErrors: { email: addErrorMessages[result.error] } });
			}
			return fail(400, { message: addErrorMessages[result.error] });
		}
		if (!result.emailSent) {
			// The client is saved; only the email bounced. Hand back the link so the
			// therapist can share it by hand, and say what happened.
			return {
				inviteUrl: result.inviteUrl,
				message: `${name} was added, but the invite email could not be sent. Share this link with them directly or use Resend invite later.`
			};
		}
	},

	delete: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		await deleteClient(therapistId, clientId);
	},

	resendInvite: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';

		const result = await resendInvite(therapistId, clientId, event.url.origin);

		if ('error' in result && result.error !== undefined) {
			return fail(400, { message: resendErrorMessages[result.error] });
		}
		if (!result.emailSent) {
			return {
				inviteUrl: result.inviteUrl,
				message: 'The invite email could not be sent. Share this link with the client directly.'
			};
		}

		return { inviteUrl: result.inviteUrl };
	},

	// Bulk add step 1: the AI reads the pasted text. Saves nothing.
	extract: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const text = formData.get('text')?.toString() ?? '';

		const result = await extractBulkClients(therapistId, text);
		if ('error' in result) {
			return fail(result.status, { bulkError: result.error });
		}
		return { bulkRows: result.rows, bulkTruncated: result.truncated };
	},

	// Bulk add step 2: save the rows the therapist reviewed, inviting each one.
	bulkAdd: async (event) => {
		const therapistId = event.locals.therapistId!;
		const formData = await event.request.formData();
		const rows = parseBulkRows(formData.get('rows')?.toString() ?? '');

		if (rows === null || rows.length === 0) {
			return fail(400, { bulkError: 'No clients to add.' });
		}
		if (rows.length > BULK_MAX_ROWS) {
			return fail(400, { bulkError: `You can add up to ${BULK_MAX_ROWS} clients at once.` });
		}

		const bulkResults = await bulkAddClients(therapistId, rows, event.url.origin);
		return { bulkResults };
	}
};