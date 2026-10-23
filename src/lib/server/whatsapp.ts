import { env } from '$env/dynamic/private';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const FETCH_TIMEOUT_MS = 20_000;

export class WhatsAppSendError extends Error {
	constructor(
		public status: number,
		public metaCode: number | null,
		reason: string
	) {
		let codeLabel = 'none';
		if (metaCode !== null) {
			codeLabel = String(metaCode);
		}
		super(`WhatsApp send failed (${status}, code ${codeLabel}): ${reason}`);
	}
}

// Missing credentials means WhatsApp is off and everything goes by email, so local
// dev and tests need no Meta setup.
export function isWhatsAppConfigured(): boolean {
	if (!env.WHATSAPP_ACCESS_TOKEN) {
		return false;
	}
	if (!env.WHATSAPP_PHONE_NUMBER_ID) {
		return false;
	}
	return true;
}

// A list fills a template's positional {{1}}, {{2}}...; an object fills its named
// {{therapist_name}}-style params. Which one depends on how the template was created.
export type TemplateParams = string[] | Record<string, string>;

export type TemplateValues = {
	header?: TemplateParams;
	body?: TemplateParams;
	// fills the first button: the trailing {{1}} of a URL button, or the code on an
	// Authentication template's copy-code button
	button?: string;
};

function toParameters(params: TemplateParams): Record<string, string>[] {
	const parameters: Record<string, string>[] = [];
	if (Array.isArray(params)) {
		for (const value of params) {
			parameters.push({ type: 'text', text: value });
		}
	} else {
		for (const [name, value] of Object.entries(params)) {
			parameters.push({ type: 'text', parameter_name: name, text: value });
		}
	}
	return parameters;
}

// Sends an approved template. phone is E.164 as parsePhone returns it; Meta wants
// bare digits. language must match the template's exactly as WhatsApp Manager shows
// it (lumno_otp is en_US, the reminders are en).
export async function sendWhatsAppTemplate(
	phone: string,
	templateName: string,
	language: string,
	values: TemplateValues
): Promise<void> {
	if (!isWhatsAppConfigured()) {
		throw new Error('WhatsApp is not configured');
	}

	const components: Record<string, unknown>[] = [];
	if (values.header !== undefined) {
		components.push({ type: 'header', parameters: toParameters(values.header) });
	}
	if (values.body !== undefined) {
		components.push({ type: 'body', parameters: toParameters(values.body) });
	}
	if (values.button !== undefined) {
		components.push({
			type: 'button',
			sub_type: 'url',
			index: '0',
			parameters: [{ type: 'text', text: values.button }]
		});
	}

	const res = await fetch(`${GRAPH_BASE}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			messaging_product: 'whatsapp',
			to: phone.replace(/^\+/, ''),
			type: 'template',
			template: {
				name: templateName,
				language: { code: language },
				components
			}
		}),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!res.ok) {
		const { metaCode, reason } = await errorDetails(res);
		throw new WhatsAppSendError(res.status, metaCode, reason);
	}
}

// Meta's error body is { error: { code, message } }. It names what was rejected and
// never echoes the access token, so it's safe to log.
async function errorDetails(res: Response): Promise<{ metaCode: number | null; reason: string }> {
	try {
		const body = (await res.json()) as { error?: { code?: number; message?: string } };
		if (body.error) {
			let metaCode: number | null = null;
			if (typeof body.error.code === 'number') {
				metaCode = body.error.code;
			}
			let reason = '';
			if (body.error.message) {
				reason = body.error.message;
			}
			return { metaCode, reason };
		}
	} catch {
		// not JSON; the status alone will do
	}
	return { metaCode: null, reason: '' };
}
