<script lang="ts">
	import { page, navigating } from '$app/state';
	import { enhance } from '$lib/enhance';
	import Logo from '$lib/components/utils/Logo.svelte';
	import SidebarNavItem from '$lib/components/utils/SidebarNavItem.svelte';
	import Avatar from '$lib/components/utils/Avatar.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/calendar', label: 'Calendar' },
		{ href: '/clients', label: 'Clients' },
		{ href: '/payments', label: 'Payments' },
		{ href: '/notes', label: 'Notes' },
		{ href: '/referrals', label: 'Referrals' },
		{ href: '/settings', label: 'Settings' }
	];
</script>

<div class="app-shell">
	<aside class="sidebar">
		<div class="sidebar-logo"><Logo /></div>
		{#each links as link (link.href)}
			<a
				href={link.href}
				class="sidebar-link"
				class:pending={navigating.to?.url.pathname === link.href}
				aria-busy={navigating.to?.url.pathname === link.href}
			>
				<SidebarNavItem label={link.label} active={page.url.pathname === link.href} />
			</a>
		{/each}
		<div class="sidebar-spacer"></div>
		<form method="POST" action="/logout" class="sidebar-link" use:enhance>
			<button type="submit" class="sidebar-link-btn"><SidebarNavItem label="Log out" /></button>
		</form>
	</aside>
	<div class="app-main">
		<header class="app-header">
			<div class="app-header-title">
				{links.find((l) => l.href === page.url.pathname)?.label ?? ''}
			</div>
			<Avatar name="Dana Reyes" />
		</header>
		<div class="app-content" class:loading={navigating.to !== null}>
			{@render children()}
		</div>
	</div>
</div>

<style>
	.app-shell {
		display: flex;
		height: 100vh;
		background: var(--surface-app);
	}

	.sidebar {
		width: 220px;
		flex-shrink: 0;
		border-right: 1px solid var(--border-subtle);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.sidebar-logo {
		margin-bottom: 18px;
		padding-left: 4px;
	}

	.sidebar-link {
		text-decoration: none;
	}

	.sidebar-link.pending {
		opacity: 0.55;
		animation: pulse 0.9s ease-in-out infinite alternate;
	}

	@keyframes pulse {
		to {
			opacity: 1;
		}
	}

	.app-content.loading {
		opacity: 0.5;
		pointer-events: none;
		transition: opacity 0.15s;
	}

	.sidebar-link-btn {
		width: 100%;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		text-align: left;
		cursor: pointer;
		font-family: var(--font-body);
	}

	.sidebar-spacer {
		flex: 1;
	}

	.app-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.app-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border-subtle);
	}

	.app-header-title {
		font-weight: 700;
		font-size: 15px;
		color: var(--text-primary);
	}

	.app-content {
		flex: 1;
		padding: 24px;
		overflow-y: auto;
	}
</style>