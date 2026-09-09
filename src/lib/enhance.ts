import { enhance as kitEnhance } from '$app/forms';
import type { SubmitFunction } from '@sveltejs/kit';

// Drop-in replacement for $app/forms enhance. Same signature, but while the
// action is in flight the form gets aria-busy and the submit button is disabled,
// so users see something happening instead of a frozen page.
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

		return async (result) => {
			// the user's submit function may cancel synchronously or return a
			// callback; either way we always clear the busy state at the end
			try {
				if (cancelled) {
					return;
				}
				const resolved = await userCallback;
				if (resolved) {
					await resolved(result);
				} else {
					await result.update();
				}
			} finally {
				setBusy(false);
			}
		};
	};

	return kitEnhance(form, busySubmit);
}
