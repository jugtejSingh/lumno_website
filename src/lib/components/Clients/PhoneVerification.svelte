<script lang="ts">
	import Button from '$lib/components/utils/Button.svelte';
	import Badge from '$lib/components/utils/Badge.svelte';
	import { enhance } from '$lib/enhance';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';

	// Verifies one not-yet-verified number. The page hosting this must define the
	// sendPhoneCode and verifyPhoneCode actions (portal details and the invite page do).
	// phone is posted with the send so the invite page can save it as pending first; the
	// portal ignores it and uses the pending number it already saved.
	// Key this component on the phone, so a new number starts from a clean state.
	let { phone }: { phone: string } = $props();

	let verifiedHere = $state(false);
	let codeSent = $state(false);
	let code = $state('');
	let message = $state('');

	const SEND_MESSAGES: Record<string, string> = {
		no_phone: 'Add a phone number first.',
		cooldown: 'A code was just sent. Wait a minute before asking for another.',
		rate_limited: 'Too many codes sent. Try again in an hour.',
		number_rate_limited: 'This number has had too many codes today. Try again tomorrow.',
		not_configured: "WhatsApp verification isn't available right now.",
		send_failed: "We couldn't send the code. Check the number is on WhatsApp and try again."
	};

	const VERIFY_MESSAGES: Record<string, string> = {
		invalid: 'Enter the 6-digit code.',
		no_code: 'No code to check. Send a new one.',
		expired: 'Code expired, send a new one.',
		locked: 'Too many wrong tries, send a new one.'
	};

	function failureData(result: { type: string; data?: Record<string, unknown> }) {
		if (result.type === 'failure' && result.data) {
			return result.data;
		}
		return null;
	}

	// The callbacks never call update(), so these results don't land in the page's
	// `form` prop and can't clash with the page's own forms' messages.
	const submitSend: SubmitFunction = () => {
		message = '';
		return async ({ result }) => {
			if (result.type === 'success') {
				codeSent = true;
				code = '';
				return;
			}
			const data = failureData(result);
			if (data && data.reason === 'already_verified') {
				verifiedHere = true;
				return;
			}
			if (data && typeof data.reason === 'string' && SEND_MESSAGES[data.reason]) {
				message = SEND_MESSAGES[data.reason];
			} else if (data && typeof data.message === 'string') {
				message = data.message;
			} else if (result.type !== 'error') {
				message = "We couldn't send the code. Please try again.";
			}
		};
	};

	const submitVerify: SubmitFunction = () => {
		message = '';
		return async ({ result }) => {
			if (result.type === 'success') {
				verifiedHere = true;
				// the number is now client.phone; let the page reload its phone data
				await invalidateAll();
				return;
			}
			const data = failureData(result);
			if (data && data.reason === 'wrong' && typeof data.triesLeft === 'number') {
				if (data.triesLeft === 1) {
					message = 'Wrong code, 1 try left.';
				} else {
					message = `Wrong code, ${data.triesLeft} tries left.`;
				}
			} else if (data && typeof data.reason === 'string' && VERIFY_MESSAGES[data.reason]) {
				message = VERIFY_MESSAGES[data.reason];
			} else if (data && typeof data.message === 'string') {
				message = data.message;
			} else if (result.type !== 'error') {
				message = "We couldn't check the code. Please try again.";
			}
		};
	};
</script>

<div class="verify">
	{#if verifiedHere}
		<Badge tone="success">Verified on WhatsApp</Badge>
	{:else}
		<form class="row" method="POST" action="?/sendPhoneCode" use:enhance={submitSend}>
			<input type="hidden" name="phone" value={phone} />
			{#if codeSent}
				<span class="hint">We sent a code to {phone} on WhatsApp.</span>
				<button type="submit" class="link">Resend</button>
			{:else}
				<Button type="submit" variant="secondary" size="sm">Verify on WhatsApp</Button>
			{/if}
		</form>
		{#if codeSent}
			<form class="row" method="POST" action="?/verifyPhoneCode" use:enhance={submitVerify}>
				<input
					class="code-input"
					name="code"
					aria-label="6-digit code"
					inputmode="numeric"
					autocomplete="one-time-code"
					maxlength="6"
					placeholder="123456"
					bind:value={code}
				/>
				<Button type="submit" variant="primary" size="sm">Confirm</Button>
			</form>
		{/if}
		{#if message}
			<div class="error" role="alert">{message}</div>
		{/if}
	{/if}
</div>

<style>
	.verify {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
		text-decoration: underline;
		cursor: pointer;
	}

	.code-input {
		width: 9ch;
		box-sizing: content-box;
		font-family: var(--font-body);
		font-size: 16px;
		letter-spacing: 0.2em;
		color: var(--text-primary);
		background: var(--surface-card);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-inset);
		padding: 8px 10px;
	}

	.code-input:focus {
		outline: none;
		border-color: var(--outline);
		background: var(--coral-100);
		box-shadow: var(--shadow-focus);
	}

	.error {
		font-size: 13px;
		color: var(--accent-danger, #c0392b);
	}
</style>
