// Regenerates every favicon / app icon in static/ from src/lib/brand/star.js.
// Run with: npm run icons
// ponytail: rasterises via the Playwright Chromium already installed for e2e, so no image library dependency.

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import {
	STAR_VIEWBOX,
	STAR_PATH,
	SPARKLE_PATH,
	STAR_COLOR,
	SPARKLE_COLOR,
	ICON_BACKGROUND
} from '../src/lib/brand/star.js';

const STATIC_DIR = new URL('../static/', import.meta.url);

// scale = how much of the canvas the star fills; every icon sits on the app background.
const FAVICON_SCALE = 0.8;

const PNG_ICONS = [
	{ file: 'favicon-96x96.png', size: 96, scale: FAVICON_SCALE },
	{ file: 'apple-touch-icon.png', size: 180, scale: 0.7 },
	// Maskable icons get cropped to a circle of radius 40%; 0.6 keeps the sparkle tip inside it.
	{ file: 'web-app-manifest-192x192.png', size: 192, scale: 0.6 },
	{ file: 'web-app-manifest-512x512.png', size: 512, scale: 0.6 },
	// Uploaded by hand in dashboards; served from /brand/ so a URL is available too.
	// Google OAuth consent screen: square, 120x120, PNG, <= 1MB.
	{ file: 'brand/google-oauth-logo-120.png', size: 120, scale: 0.7 },
	// Razorpay OAuth app, business logo and subscription checkout: square, min 256x256, PNG, <= 1MB.
	{ file: 'brand/razorpay-logo-256.png', size: 256, scale: 0.7 },
	{ file: 'brand/razorpay-logo-512.png', size: 512, scale: 0.7 }
];

// General-purpose square logos: static/brand/logo-<size>.png
const LOGO_SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 256, 512, 1000, 1024];

for (const size of LOGO_SIZES) {
	// Tiny sizes need the star bigger to stay legible.
	let scale = 0.7;
	if (size <= 48) {
		scale = FAVICON_SCALE;
	}
	PNG_ICONS.push({ file: `brand/logo-${size}.png`, size, scale });
}

const ICO_SIZES = [16, 32, 48];

function buildSvg(scale) {
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${STAR_VIEWBOX}">`,
		`<rect width="32" height="32" fill="${ICON_BACKGROUND}"/>`,
		`<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">`,
		`<path fill="${STAR_COLOR}" d="${STAR_PATH}"/>`,
		`<path fill="${SPARKLE_COLOR}" d="${SPARKLE_PATH}"/>`,
		`</g>`,
		`</svg>`
	].join('');
}

async function renderPng(page, svg, size) {
	await page.setViewportSize({ width: size, height: size });
	const html = `<html><body style="margin:0;background:transparent">${svg.replace(
		'<svg ',
		`<svg width="${size}" height="${size}" style="display:block" `
	)}</body></html>`;
	await page.setContent(html);
	return page.screenshot({ omitBackground: true });
}

// ICO container holding PNG images (supported by every modern browser).
function buildIco(pngs) {
	const headerSize = 6;
	const entrySize = 16;
	const header = Buffer.alloc(headerSize + entrySize * pngs.length);

	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(pngs.length, 4);

	let offset = header.length;
	for (let index = 0; index < pngs.length; index++) {
		const { size, data } = pngs[index];
		const entry = headerSize + entrySize * index;

		let dimensionByte = size;
		if (size >= 256) {
			dimensionByte = 0; // 0 means 256 in the ICO format
		}

		header.writeUInt8(dimensionByte, entry); // width
		header.writeUInt8(dimensionByte, entry + 1); // height
		header.writeUInt8(0, entry + 2); // palette colours
		header.writeUInt8(0, entry + 3); // reserved
		header.writeUInt16LE(1, entry + 4); // colour planes
		header.writeUInt16LE(32, entry + 6); // bits per pixel
		header.writeUInt32LE(data.length, entry + 8);
		header.writeUInt32LE(offset, entry + 12);

		offset = offset + data.length;
	}

	const parts = [header];
	for (const png of pngs) {
		parts.push(png.data);
	}
	return Buffer.concat(parts);
}

async function main() {
	await mkdir(new URL('brand/', STATIC_DIR), { recursive: true });
	await writeFile(new URL('favicon.svg', STATIC_DIR), buildSvg(FAVICON_SCALE));
	console.log('wrote favicon.svg');

	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();

		for (const icon of PNG_ICONS) {
			const svg = buildSvg(icon.scale);
			const data = await renderPng(page, svg, icon.size);
			await writeFile(new URL(icon.file, STATIC_DIR), data);
			console.log(`wrote ${icon.file}`);
		}

		const icoPngs = [];
		for (const size of ICO_SIZES) {
			const data = await renderPng(page, buildSvg(FAVICON_SCALE), size);
			icoPngs.push({ size, data });
		}
		await writeFile(new URL('favicon.ico', STATIC_DIR), buildIco(icoPngs));
		console.log('wrote favicon.ico');
	} finally {
		await browser.close();
	}
}

main();
