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

// Sends an approved template. phone is E.164 as parsePhone returns it; Meta wants
// bare digits. language must match the template's exactly as WhatsApp Manager shows
// it (lumno_otp is en_US, the reminders are en). buttonParam fills the first button:
// the trailing {{1}} of a URL button, or the code on an Authentication template's
// copy-code button.
export async function sendWhatsAppTemplate(
	phone: string,
	templateName: string,
	language: string,
	bodyParams: string[],
	buttonParam?: string
): Promise<void> {
	if (!isWhatsAppConfigured()) {
		throw new Error('WhatsApp is not configured');
	}

	const bodyParameters: { type: 'text'; text: string }[] = [];
	for (const value of bodyParams) {
		bodyParameters.push({ type: 'text', text: value });
	}

	const components: Record<string, unknown>[] = [];
	if (bodyParameters.length > 0) {
		components.push({ type: 'body', parameters: bodyParameters });
	}
	if (buttonParam !== undefined) {
		components.push({
			type: 'button',
			sub_type: 'url',
			index: '0',
			parameters: [{ type: 'text', text: buttonParam }]
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
