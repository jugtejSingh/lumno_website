import { enhance as kitEnhance } from '$app/forms';
import { toast } from 'svelte-sonner';
import type { SubmitFunction } from '@sveltejs/kit';

// Drop-in replacement for $app/forms enhance. Same signature, but while the
// action is in flight the form gets aria-busy and the submit button is disabled,
// so users see something happening instead of a frozen page. A thrown error
// (result.type === 'error': the action crashed, or the network dropped) is
// toasted here so no dialog form silently swallows it — the message is the
// generic one handleError chose, never the raw server error.
export function enhance(form: HTMLFormElement, submit?: SubmitFunction) {
	const busySubmit: SubmitFunction = (input) => {
		const button = (input.submitter ?? form.querySelector('[type="submit"]')) as
			| HTMLButtonElement
			| null;

		function setBusy(busy: boolean) {
			if (busy) {
				form.setAttribute('aria-busy', 'true');
			} else {
				form.removeAttribute('aria-busy');
			}
			if (button) {
				button.disabled = busy;
			}
		}

		setBusy(true);

		let cancelled = false;
		const cancel = () => {
			cancelled = true;
			setBusy(false);
			input.cancel();
		};

		const userCallback = submit ? submit({ ...input, cancel }) : undefined;

		return async (event) => {
			// the user's submit function may cancel synchronously or return a
			// callback; either way we always clear the busy state at the end
			try {
				if (cancelled) {
					return;
				}
				const result = event.result;
				if (result.type === 'error') {
					let message = 'Something went wrong. Please try again.';
					if (result.error && typeof result.error.message === 'string' && result.error.message) {
						message = result.error.message;
					}
					toast.error(message);
				}
				const resolved = await userCallback;
				if (resolved) {
					await resolved(event);
				} else {
					await event.update();
				}
			} finally {
				setBusy(false);
			}
		};
	};

	return kitEnhance(form, busySubmit);
}
