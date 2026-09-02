// Public marketing pages only — (app)/(portal) are behind auth, /demo is dev-only,
// and the invite/become-therapist routes are single-use private links. None belong indexed.
const SITE_URL = 'https://lumno.in';
const PAGES = ['/', '/pricing', '/login', '/privacy', '/terms'];

export function GET() {
	const urls = PAGES.map((path) => `\t<url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
