import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { parseInvoiceSettingsForm } from '$lib/invoiceValidation';
import {
	getInvoiceSettings,
	saveInvoiceSettings,
	isInrTherapist
} from '$lib/server/invoiceSettings';
import { putObject, deleteObject, signedUrl } from '$lib/server/storage';
import { logError } from '$lib/server/log';
import { isImageKeyOnAnInvoice } from '$lib/server/invoices';
import { DEFAULT_SAC_CODE, DEFAULT_GST_RATE } from '$lib/invoice';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// raster only — an SVG can carry script, and the stored content type is the browser's claim
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { therapist } = await parent();
	if (therapist.currency !== 'INR') {
		redirect(303, '/settings');
	}

	const row = await getInvoiceSettings(locals.therapistId!);

	let logoUrl: string | null = null;
	if (row && row.logoKey) {
		logoUrl = await signedUrl(row.logoKey);
	}
	let signatureUrl: string | null = null;
	if (row && row.signatureKey) {
		signatureUrl = await signedUrl(row.signatureKey);
	}

	// strings, as the form edits them; blank defaults when never saved
	let settings = {
		legalName: '',
		address: '',
		stateCode: '',
		gstin: '',
		sacCode: DEFAULT_SAC_CODE,
		defaultGstRate: DEFAULT_GST_RATE,
		numberPrefix: '',
		nextNumber: '1',
		footer: '',
		extraFields: [] as { label: string; value: string }[]
	};
	if (row) {
		settings = {
			legalName: row.legalName ?? '',
			address: row.address,
			stateCode: row.stateCode,
			gstin: row.gstin ?? '',
			sacCode: row.sacCode,
			defaultGstRate: String(row.defaultGstRate),
			numberPrefix: row.numberPrefix ?? '',
			nextNumber: String(row.nextNumber),
			footer: row.footer ?? '',
			extraFields: row.extraFields
		};
	}

	return { settings, logoUrl, signatureUrl };
};

type ImageResult = { file: File | null } | { error: string };

function readImage(form: FormData, name: string): ImageResult {
	const file = form.get(name);
	if (!(file instanceof File) || file.size === 0) {
		return { file: null };
	}
	if (!IMAGE_TYPES.includes(file.type)) {
		return { error: 'Must be a PNG, JPEG or WebP image' };
	}
	if (file.size > MAX_IMAGE_BYTES) {
		return { error: 'Must be under 2 MB' };
	}
	return { file };
}

// Upload a new image, or clear/keep the current key. Upload happens before the
// DB write so a failed upload leaves the row untouched.
async function nextImageKey(
	therapistId: string,
	kind: 'logo' | 'signature',
	currentKey: string | null,
	file: File | null,
	remove: boolean
): Promise<string | null> {
	if (file) {
		const key = `invoice/${therapistId}/${kind}/${randomUUID()}`;
		await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);
		return key;
	}
	if (remove) {
		return null;
	}
	return currentKey;
}

async function deleteReplaced(therapistId: string, oldKey: string | null, newKey: string | null) {
	if (!oldKey || oldKey === newKey) {
		return;
	}
	try {
		// issued invoices keep pointing at the image they were issued with
		if (await isImageKeyOnAnInvoice(oldKey)) {
			return;
		}
		await deleteObject(oldKey);
	} catch (err) {
		// ponytail: an orphaned object is harmless, just log it
		logError('settings.invoices.imageDelete', err, { therapistId, key: oldKey });
	}
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const therapistId = locals.therapistId!;
		if (!(await isInrTherapist(therapistId))) {
			return fail(403, { field: '', message: 'Invoices are only available for INR practices' });
		}
		const form = await request.formData();

		const parsed = parseInvoiceSettingsForm(form);
		if ('field' in parsed) {
			return fail(400, parsed);
		}

		const logo = readImage(form, 'logo');
		if ('error' in logo) {
			return fail(400, { field: 'logo', message: `Logo: ${logo.error}` });
		}
		const signature = readImage(form, 'signature');
		if ('error' in signature) {
			return fail(400, { field: 'signature', message: `Signature: ${signature.error}` });
		}

		const current = await getInvoiceSettings(therapistId);
		let currentLogoKey: string | null = null;
		let currentSignatureKey: string | null = null;
		if (current) {
			currentLogoKey = current.logoKey;
			currentSignatureKey = current.signatureKey;
		}

		const logoKey = await nextImageKey(
			therapistId,
			'logo',
			currentLogoKey,
			logo.file,
			form.get('removeLogo') === 'on'
		);
		const signatureKey = await nextImageKey(
			therapistId,
			'signature',
			currentSignatureKey,
			signature.file,
			form.get('removeSignature') === 'on'
		);

		await saveInvoiceSettings(therapistId, parsed.settings, { logoKey, signatureKey });

		await deleteReplaced(therapistId, currentLogoKey, logoKey);
		await deleteReplaced(therapistId, currentSignatureKey, signatureKey);

		return { saved: true };
	}
};
