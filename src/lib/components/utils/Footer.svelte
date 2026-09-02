<script lang="ts">
	import Logo from './Logo.svelte';
</script>

<footer class="footer">
	<Logo size={18} />
	<div class="copyright">&#169; 2026 Lumno. Practice management for therapists.</div>
	<div class="footer-links">
		<a href="/">Home</a>
		<a href="/login">Log in</a>
	</div>
</footer>

<style>
	.footer {
		border-top: 1px solid var(--border-subtle);
		padding: 28px 48px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.copyright {
		font-size: 13px;
		color: var(--text-muted);
	}

	.footer-links {
		display: flex;
		gap: 18px;
	}

	.footer-links a {
		font-size: 13px;
		color: var(--text-muted);
		text-decoration: none;
	}
</style>