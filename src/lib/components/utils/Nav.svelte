<script lang="ts">
	import Logo from './Logo.svelte';
	import Button from './Button.svelte';
</script>

<header class="nav">
	<Logo />
	<div class="nav-links">
		<a href="/#features">Features</a>
		<a href="/pricing">Pricing</a>
		<Button href="/login" variant="secondary" size="md">Log in</Button>
		<Button href="/login?tab=register" variant="primary" size="md">Get started for free</Button>
	</div>
</header>

<style>
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 48px;
		border-bottom: 1px solid var(--border-subtle);
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 28px;
	}

	.nav-links > a {
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		color: var(--text-secondary);
	}
</style>