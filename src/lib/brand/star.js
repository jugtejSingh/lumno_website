// Single source for the Lumno star mark. Used by Logo.svelte and scripts/generate-icons.mjs.
// Paths are drawn on a 32x32 viewBox.

export const STAR_VIEWBOX = '0 0 32 32';

export const STAR_PATH =
	'M16 1.5 C17.2 10.5 21.5 14.8 30.5 16 C21.5 17.2 17.2 21.5 16 30.5 C14.8 21.5 10.5 17.2 1.5 16 C10.5 14.8 14.8 10.5 16 1.5 Z';

export const SPARKLE_PATH =
	'M26 2.5 C26.4 5.2 27.3 6.1 30 6.5 C27.3 6.9 26.4 7.8 26 10.5 C25.6 7.8 24.7 6.9 22 6.5 C24.7 6.1 25.6 5.2 26 2.5 Z';

// Hex copies of --coral-500 / --plum-500 / --surface-app for static files that can't read CSS vars.
export const STAR_COLOR = '#F08A4B';
export const SPARKLE_COLOR = '#DB8F8E';
export const ICON_BACKGROUND = '#FCE7D5';
