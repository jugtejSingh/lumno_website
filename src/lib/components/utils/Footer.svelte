<script lang="ts">
	import Logo from './Logo.svelte';
	import FeedbackDialog from './FeedbackDialog.svelte';

	let feedbackOpen = $state(false);
</script>

<footer class="footer">
	<Logo size={18} />
	<div class="copyright">
		&#169; {new Date().getFullYear()} Lumno. Practice management for therapists.
	</div>
	<div class="footer-links">
		<a href="/">Home</a>
		<a href="/login">Log in</a>
		<a href="/privacy">Privacy</a>
		<a href="/terms">Terms</a>
		<button type="button" class="footer-link-btn" onclick={() => (feedbackOpen = true)}>
			Feedback
		</button>
	</div>
</footer>

<FeedbackDialog open={feedbackOpen} onclose={() => (feedbackOpen = false)} />

<style>
	.footer {
		border-top: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		padding: 28px clamp(16px, 5vw, 48px);
		/* equal side columns so the copyright sits on the page's centre line,
		   not wherever the logo and link widths happen to leave it */
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 14px;
	}

	.copyright {
		font-size: 13px;
		color: var(--text-muted);
		text-align: center;
	}

	.footer-links {
		display: flex;
		justify-content: end;
		gap: 18px;
	}

	@media (max-width: 640px) {
		.footer {
			grid-template-columns: 1fr;
			justify-items: center;
		}

		.footer-links {
			flex-wrap: wrap;
			justify-content: center;
		}
	}

	.footer-links a,
	.footer-link-btn {
		font-size: 13px;
		color: var(--text-muted);
		text-decoration: none;
	}

	/* opens a dialog rather than a page, so it shouldn't read as another page link */
	.footer-link-btn {
		border: none;
		background: transparent;
		padding: 0;
		font-family: var(--font-body);
		text-decoration: underline dotted var(--beige-400);
		text-underline-offset: 4px;
		cursor: pointer;
	}

	.footer-link-btn:hover {
		color: var(--text-primary);
		text-decoration-color: var(--coral-500);
	}
</style>
