<script lang="ts">
	import Logo from './Logo.svelte';
	import Button from './Button.svelte';
	import MobileNav from './MobileNav.svelte';
</script>

<header class="nav">
	<Logo />
	<div class="nav-links">
		<a href="/#features">Features</a>
		<a href="/pricing">Pricing</a>
		<Button href="/login" variant="secondary" size="md">Log in</Button>
		<Button href="/login?tab=register" variant="primary" size="md">Get started for free</Button>
	</div>
	<MobileNav>
		<a href="/#features">Features</a>
		<a href="/pricing">Pricing</a>
		<a href="/login">Log in</a>
		<a href="/login?tab=register">Get started for free</a>
	</MobileNav>
</header>

<style>
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 20px clamp(16px, 5vw, 48px);
		border-bottom: 1px solid var(--border-subtle);
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: clamp(12px, 3vw, 28px);
	}

	.nav-links > a {
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		color: var(--text-secondary);
	}

	/* below 820px the burger (in MobileNav) takes over */
	@media (max-width: 820px) {
		.nav-links {
			display: none;
		}
	}
</style>
