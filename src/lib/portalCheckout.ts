import { invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';

// Razorpay "Pay now" for the portal payments page (automatic mode only).

export type InvoiceCheckout = {
	orderId: string;
	key: string;
	amountMinor: number;
	therapistName: string;
};

export const PAY_ERRORS: Record<string, string> = {
	invoice_not_found: 'That invoice could not be found.',
	not_payable: 'That invoice is no longer payable.',
	currency_unsupported: 'Online payment is not available for this practice.',
	payments_unavailable: 'Your practitioner is not set up to take payments right now.',
	checkout_failed: 'Could not start checkout. Please try again.'
};

function loadCheckoutScript(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (window.Razorpay) {
			resolve();
			return;
		}
		const script = document.createElement('script');
		script.src = 'https://checkout.razorpay.com/v1/checkout.js';
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('failed to load checkout script'));
		document.head.appendChild(script);
	});
}

// onclosed runs when checkout finishes or is dismissed, so the page can clear its
// "Opening…" state.
export async function openInvoiceCheckout(checkout: InvoiceCheckout, onclosed: () => void) {
	try {
		await loadCheckoutScript();
		new window.Razorpay({
			key: checkout.key,
			order_id: checkout.orderId,
			amount: checkout.amountMinor,
			currency: 'INR',
			name: checkout.therapistName,
			// The webhook flips the invoice to paid; this is just UX feedback.
			handler: () => {
				toast.success('Payment received — updating your invoice…');
				onclosed();
				invalidateAll();
				// The webhook usually lands a few seconds after Checkout closes, so
				// the first refresh often still sees "unpaid". One more catches it.
				// ponytail: fixed delay; poll until paid if this proves flaky.
				setTimeout(() => {
					invalidateAll();
				}, 5000);
			},
			modal: { ondismiss: () => onclosed() }
		}).open();
	} catch {
		toast.error('Could not open checkout. Please try again.');
		onclosed();
	}
}
