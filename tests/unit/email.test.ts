import { describe, it, expect } from 'vitest';

// email.ts builds its Resend client on import, which throws without a key.
process.env.RESEND_API ??= 'test';
const { escapeHtml, wrapEmail } = await import('../../src/lib/server/email');

describe('escapeHtml', () => {
	it('neutralises markup and attribute breakouts', () => {
		expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
	});
});

describe('wrapEmail', () => {
	it('escapes the plain-text fields and leaves bodyHtml as HTML', () => {
		const html = wrapEmail({
			heading: '<script>x</script>',
			bodyHtml: '<p>ok</p>',
			cta: { text: '<i>click</i>', url: 'https://meet.test/?a="b"' },
			footerNote: '<img src=x>'
		});

		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<i>');
		expect(html).not.toContain('<img');
		expect(html).toContain('href="https://meet.test/?a=&quot;b&quot;"');
		expect(html).toContain('<p>ok</p>');
	});
});
