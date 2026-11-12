import { render } from 'svelte/server';
import { dev } from '$app/environment';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import InvoiceDocument from '$lib/components/Invoices/InvoiceDocument.svelte';
import { getObject } from '$lib/server/storage';
import type { InvoiceRow } from '$lib/server/invoices';
import nunitoLatin from './fonts/nunito-latin.woff2?inline';
import nunitoLatinExt from './fonts/nunito-latin-ext.woff2?inline';

// Server-side PDF for invoice emails (no browser is involved in an auto-send).
// The same InvoiceDocument the browser prints is rendered to HTML and printed by
// headless Chromium. Fonts and images are inlined as data URIs so Chromium makes
// no network requests. Nunito's latin-ext subset carries the ₹ sign.
// No third-party PDF API: invoices carry client names and session dates.

const FONT_CSS = `
@font-face { font-family: 'Nunito'; font-weight: 200 1000; src: url(${nunitoLatin}) format('woff2');
	unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'Nunito'; font-weight: 200 1000; src: url(${nunitoLatinExt}) format('woff2');
	unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
:root { --font-body: 'Nunito', sans-serif; }
html, body { margin: 0; }
`;

// Locally (Windows) the installed Chrome; on Vercel the serverless Chromium build.
// puppeteer-core 25.11.0 targets Chromium 153 = @sparticuz/chromium 153.0.0;
// both are pinned exactly and must be upgraded together.
const LOCAL_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function launchBrowser() {
	if (dev) {
		return puppeteer.launch({ executablePath: LOCAL_CHROME, headless: true });
	}
	return puppeteer.launch({
		args: chromium.args,
		executablePath: await chromium.executablePath(),
		headless: true
	});
}

async function imageDataUri(key: string | null): Promise<string | null> {
	if (!key) {
		return null;
	}
	const image = await getObject(key);
	return `data:${image.contentType};base64,${Buffer.from(image.bytes).toString('base64')}`;
}

export function invoiceHtml(
	row: InvoiceRow,
	logoUrl: string | null,
	signatureUrl: string | null
): string {
	const rendered = render(InvoiceDocument, {
		props: {
			invoice: row.data,
			logoUrl,
			signatureUrl,
			cancelled: row.status === 'cancelled'
		}
	});
	return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}</style>${rendered.head}</head><body>${rendered.body}</body></html>`;
}

// ~3–5 s on a cold start, ~1 s warm. Launch and close per request.
export async function renderInvoicePdf(row: InvoiceRow): Promise<Uint8Array> {
	const logoUrl = await imageDataUri(row.logoKey);
	const signatureUrl = await imageDataUri(row.signatureKey);
	const html = invoiceHtml(row, logoUrl, signatureUrl);

	const browser = await launchBrowser();
	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: 'load' });
		return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
	} finally {
		await browser.close();
	}
}
