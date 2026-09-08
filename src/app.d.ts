import type { User, Session } from 'better-auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			// set in hooks.server.ts — only present when the logged-in user is also a therapist
			therapistId?: string;
			// set in hooks.server.ts — only present when the logged-in user is also a client.
			// a user can be a client of multiple therapists; this is whichever one is currently
			// active (activeClientId cookie, defaults to the newest), swappable from the portal
			clientId?: string;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Loaded at runtime from https://checkout.razorpay.com/v1/checkout.js
	// (pricing/+page.svelte) — no official types package for the web widget.
	interface Window {
		Razorpay: new (options: {
			key: string;
			subscription_id?: string; // subscription checkout (pricing page)
			order_id?: string; // order checkout (portal invoice payment)
			amount?: number; // paise — order checkout only
			currency?: string;
			name?: string;
			handler?: (response: unknown) => void;
			modal?: { ondismiss?: () => void };
		}) => { open: () => void };
	}
}

export {};
